from ultralytics import YOLO
import cv2
import requests
import base64
import time
import numpy as np
from PIL import Image, ImageEnhance
import io
import argparse
import os
import tempfile
import logging
import queue
import threading

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("cloudModel")

# --- Config ----------------------------------------
API_URL = "https://your-app.vercel.app/api/hub/incidents"
DEVICE_TOKEN = "your-device-token"
CAMERA_NAME = "Front Door"

# --- Supabase config (auto-loaded from .env.local) -
# Walk up from this file's directory until we find .env.local, then load it
# with python-dotenv so the same credentials used by the Next.js app are reused.
def _load_env() -> None:
    try:
        from dotenv import load_dotenv
    except ImportError:
        return  # dotenv not installed — fall back to plain os.environ
    _dir = os.path.dirname(os.path.abspath(__file__))
    for _ in range(4):  # search up to 4 levels up
        candidate = os.path.join(_dir, ".env.local")
        if os.path.isfile(candidate):
            load_dotenv(candidate, override=False)
            break
        _dir = os.path.dirname(_dir)

_load_env()

# Next.js uses NEXT_PUBLIC_SUPABASE_URL; plain SUPABASE_URL is a fallback
SUPABASE_URL   = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL", "")
# Service-role key — never exposed to the browser, lives only in .env.local
SUPABASE_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY", "")
STORAGE_BUCKET = "incidents"

# Statuses / route modes that need cloud analysis
CLOUD_ROUTE_MODES = {"CLOUD", "LOCAL_VERIFY_CLOUD"}

# How many incidents to pull per scan pass
SCAN_BATCH_SIZE = 20

# Seconds to wait between scan passes (when running in --cloud-scan loop)
SCAN_INTERVAL = 30

# Lower confidence threshold for low-light -- YOLO is less certain in the dark
CONFIDENCE_THRESHOLD = 0.35
COOLDOWN_SECONDS = 10

# --- Class maps ------------------------------------
PERSON_CLASSES = {0: "person"}
ANIMAL_CLASSES = {15: "cat", 16: "dog", 17: "horse", 18: "sheep", 
                  19: "cow", 20: "elephant", 21: "bear", 22: "zebra"}
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 6: "train", 7: "truck"}

ALL_TRACKED = {**PERSON_CLASSES, **ANIMAL_CLASSES, **VEHICLE_CLASSES}

# --- Low-light processing ------------------------------------
def is_low_light(frame: np.ndarray) -> bool:
    """Returns True if the frame is significantly underexposed."""
    gray = np.mean(frame, axis=2)
    return gray.mean() < 60

def enhance_frame(frame: np.ndarray) -> np.ndarray:
    """
    Brightens and sharpens the frame before passing to YOLO.
    Only applied when low-light is detected.
    """
    gamma     = 0.6
    inv_gamma = 1.0 / gamma
    table     = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
    corrected = table[frame]

    img = Image.fromarray(corrected[..., ::-1])  # BGR → RGB
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = ImageEnhance.Sharpness(img).enhance(2.0)
    return np.array(img)[..., ::-1]  # RGB → BGR

# --- Scoring ------------------------------------
def compute_threat_score(detections: list[dict], is_dark: bool) -> int:
    score = 0
    for d in detections:
        if d["category"] == "person":    score += 30
        elif d["category"] == "vehicle": score += 15
        elif d["category"] == "animal":  score += 10
    if is_dark:
        score += 15
    return min(score, 100)

def decide_route(confidence: float, quality: int, is_dark: bool) -> str:
    if is_dark and confidence < 0.65:
        return "CLOUD"
    if confidence >= 0.75 and quality >= 60:
        return "LOCAL"
    elif confidence >= 0.50:
        return "LOCAL_VERIFY_CLOUD"
    return "CLOUD"

def build_summary(detections: list[dict], is_dark: bool) -> str:
    if not detections:
        return "No objects detected."
    parts = [f"{d['label']} (conf: {d['confidence']:.2f})" for d in detections]
    conditions = " [LOW-LIGHT CONDITIONS]" if is_dark else ""
    return f"Detected: {', '.join(parts)} on {CAMERA_NAME}{conditions}"
  
# --- Snapshot from YOLO result ------------------------------------
def encode_snapshot(result) -> str:
    plotted = result.plot()
    img     = Image.fromarray(plotted[..., ::-1])
    buffer  = io.BytesIO()
    img.save(buffer, format="JPEG", quality=75)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

# --- Quality ------------------------------------
def compute_quality_score(frame: np.ndarray) -> int:
    gray = np.mean(frame, axis=2).astype(np.uint8)
    diff = np.abs(gray[1:, :].astype(int) - gray[:-1, :].astype(int))
    blur_score = min(int(diff.mean() * 10), 50)
    brightness = gray.mean()
    
    if brightness < 30:   
        brightness_score = 5
    elif brightness < 60: 
        brightness_score = 20
    elif brightness < 220: 
        brightness_score = 50
    else:                  
        brightness_score = 20
    return blur_score + brightness_score


# --- Post to API ------------------------------------
# --- Post to API ------------------------------------
def post_incident(result, detections: list[dict], is_dark: bool):
    frame    = result.orig_img
    quality  = compute_quality_score(frame)
    threat   = compute_threat_score(detections, is_dark)
    avg_conf = sum(d["confidence"] for d in detections) / len(detections)
    route    = decide_route(avg_conf, quality, is_dark)
    summary  = build_summary(detections, is_dark)
    snapshot = encode_snapshot(result)
    label    = detections[0]["label"] if len(detections) == 1 \
               else f"{len(detections)} objects detected"

    payload = {
        "camera_name":     CAMERA_NAME,
        "label":           label,
        "threat_score":    threat,
        "quality_score":   quality,
        "confidence":      round(avg_conf, 3),
        "route_mode":      route,
        "summary_local":   summary,
        "snapshot_base64": snapshot,
        "detections":      detections,
        "low_light":       is_dark,
    }

    try:
        res = requests.post(API_URL, json=payload,
                            headers={"Authorization": f"Bearer {DEVICE_TOKEN}"},
                            timeout=5)
    except Exception as e:
        print(f"⚠️  Post failed: {e}")

# ── Supabase helpers ──────────────────────────────────────────────────────────

def _supabase_client():
    """Return a supabase-py client using the service-role key (bypasses RLS)."""
    try:
        from supabase import create_client
    except ImportError:
        raise ImportError(
            "supabase-py is required for cloud-scan mode.\n"
            "  pip install supabase"
        )
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise EnvironmentError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables before "
            "running in --cloud-scan mode."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_pending_cloud_incidents(client, batch: int = SCAN_BATCH_SIZE) -> list[dict]:
    """
    Return incidents that have a CLOUD or LOCAL_VERIFY_CLOUD route mode
    but have NOT yet received a cloud summary (summary_cloud IS NULL).
    Also catches incidents whose route_mode is still NULL / empty but whose
    confidence_score or quality_score is low enough that they should be routed
    to the cloud according to decide_route().
    """
    # Primary query: explicitly routed to cloud, not yet analysed
    resp = (
        client.table("incidents")
        .select(
            "id, camera_id, primary_label, threat_score, quality_score, "
            "confidence_score, route_mode, summary_cloud, status, started_at"
        )
        .in_("route_mode", list(CLOUD_ROUTE_MODES))
        .is_("summary_cloud", "null")
        .neq("status", "rejected")
        .order("started_at", desc=True)
        .limit(batch)
        .execute()
    )
    rows = resp.data or []

    # Secondary query: any incident with no route_mode set yet and no cloud summary
    resp2 = (
        client.table("incidents")
        .select(
            "id, camera_id, primary_label, threat_score, quality_score, "
            "confidence_score, route_mode, summary_cloud, status, started_at"
        )
        .is_("route_mode", "null")
        .is_("summary_cloud", "null")
        .neq("status", "rejected")
        .order("started_at", desc=True)
        .limit(batch)
        .execute()
    )
    rows += resp2.data or []

    # Deduplicate by id
    seen: set[str] = set()
    unique: list[dict] = []
    for r in rows:
        if r["id"] not in seen:
            seen.add(r["id"])
            unique.append(r)

    log.info("Found %d incident(s) awaiting cloud analysis", len(unique))
    return unique


def _resolve_storage_path(client, incident_id: str) -> str | None:
    """
    The storage bucket uses numeric timestamp folder names (e.g. 1772344051904/clip.mp4),
    NOT UUID paths. Look up the real path via incident_media, then fall back to
    scanning the incidents table for a clip_path / storage_path column.
    Returns a storage-relative path like "1772344051904/clip.mp4", or None.
    """
    # ── 1. incident_media table ───────────────────────────────────────────────
    try:
        resp = (
            client.table("incident_media")
            .select("storage_url, media_type")
            .eq("incident_id", incident_id)
            .eq("media_type", "clip")
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if rows:
            storage_url: str = rows[0]["storage_url"]
            # If it's already a full https URL extract just the path after /object/incidents/
            if storage_url.startswith("http"):
                marker = "/object/incidents/"
                idx = storage_url.find(marker)
                if idx != -1:
                    return storage_url[idx + len(marker):]
                # also try /object/public/incidents/
                marker2 = "/object/public/incidents/"
                idx2 = storage_url.find(marker2)
                if idx2 != -1:
                    return storage_url[idx2 + len(marker2):]
                log.warning("  [%s] couldn't parse storage path from URL: %s", incident_id, storage_url)
                return None
            return storage_url  # already a relative path
    except Exception as exc:
        log.warning("  [%s] incident_media lookup failed: %s", incident_id, exc)

    # ── 2. incidents table — check for a clip_path / storage_path column ──────
    try:
        resp2 = (
            client.table("incidents")
            .select("clip_path, storage_path")
            .eq("id", incident_id)
            .limit(1)
            .execute()
        )
        row = (resp2.data or [None])[0]
        if row:
            path = row.get("clip_path") or row.get("storage_path")
            if path:
                return path
    except Exception:
        pass  # column might not exist — that's fine

    # ── 3. Scan storage for any numeric folder whose clip we can match ─────────
    # Last resort: list all folders and look for one that's close in time to started_at
    log.warning("  [%s] no media entry found — clip cannot be located", incident_id)
    return None


def download_clip(client, incident_id: str, dest_dir: str) -> str | None:
    """
    Resolve the real storage path for this incident's clip, then download it.
    Returns the local file path, or None if unavailable.
    """
    storage_path = _resolve_storage_path(client, incident_id)
    if storage_path is None:
        return None

    dest_path = os.path.join(dest_dir, f"{incident_id}_clip.mp4")
    log.info("  [%s] storage path → %s", incident_id, storage_path)

    try:
        data: bytes = client.storage.from_(STORAGE_BUCKET).download(storage_path)
        if not data:
            log.warning("  [%s] empty download response", incident_id)
            return None
        with open(dest_path, "wb") as f:
            f.write(data)
        log.info("  [%s] downloaded %d KB", incident_id, len(data) // 1024)
        return dest_path
    except Exception as exc:
        log.warning("  [%s] could not download clip: %s", incident_id, exc)
        return None


def analyze_video_file(video_path: str, model: YOLO) -> dict | None:
    """
    Run the existing YOLO pipeline over every frame of video_path.
    Aggregates detections across all frames and returns a single result dict:
        {
            threat_score:    int   (0-100),
            quality_score:   int   (0-100),
            confidence_score: float (0.0-1.0),
            route_mode:      str,
            summary_cloud:   str,
            detections:      list[dict],
        }
    Returns None if the file cannot be opened or yields no detections at all.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        log.warning("  Could not open %s", video_path)
        return None

    all_detections: list[dict] = []
    frame_qualities: list[int] = []
    frame_count = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1

        is_dark = is_low_light(frame)
        input_frame = enhance_frame(frame) if is_dark else frame

        frame_qualities.append(compute_quality_score(frame))

        results = model.predict(input_frame, verbose=False)
        result = results[0]

        if result.boxes is None:
            continue

        for box in result.boxes:
            cls_id = int(box.cls)
            conf = float(box.conf)
            if cls_id not in ALL_TRACKED or conf < CONFIDENCE_THRESHOLD:
                continue
            category = (
                "person"  if cls_id in PERSON_CLASSES  else
                "animal"  if cls_id in ANIMAL_CLASSES   else
                "vehicle"
            )
            all_detections.append({
                "label":    ALL_TRACKED[cls_id],
                "category": category,
                "confidence": round(conf, 3),
                "bbox":     [round(x) for x in box.xyxy[0].tolist()],
                "class_id": cls_id,
            })

    cap.release()

    # Aggregate quality across sampled frames
    avg_quality = int(np.mean(frame_qualities)) if frame_qualities else 50

    if not all_detections:
        log.info("  No tracked objects found in clip — marking as low-threat.")
        return {
            "threat_score":     0,
            "quality_score":    avg_quality,
            "confidence_score": 0.0,
            "route_mode":       "CLOUD",   # always CLOUD — processed here
            "summary_cloud":    "Cloud analysis complete. No persons, animals, or vehicles detected.",
            "detections":       [],
        }

    avg_conf = sum(d["confidence"] for d in all_detections) / len(all_detections)

    # Determine whether the clip was predominantly dark
    is_dark_clip = avg_quality < 40

    threat = compute_threat_score(all_detections, is_dark_clip)

    # Build a richer cloud summary
    label_counts: dict[str, int] = {}
    for d in all_detections:
        label_counts[d["label"]] = label_counts.get(d["label"], 0) + 1
    parts = [f"{cnt}× {lbl}" for lbl, cnt in label_counts.items()]
    conditions = " [LOW-LIGHT]" if is_dark_clip else ""
    summary = (
        f"Cloud analysis complete{conditions}. "
        f"Detected across {frame_count} frames: {', '.join(parts)}. "
        f"Threat score: {threat}/100. Avg confidence: {avg_conf:.2f}."
    )

    return {
        "threat_score":     threat,
        "quality_score":    avg_quality,
        "confidence_score": round(avg_conf, 4),
        "route_mode":       "CLOUD",   # always CLOUD — processed here
        "summary_cloud":    summary,
        "detections":       all_detections,
    }


def update_incident(client, incident_id: str, analysis: dict) -> bool:
    """Patch the incident row in Supabase with cloud analysis results."""
    patch = {
        "threat_score":     analysis["threat_score"],
        "quality_score":    analysis["quality_score"],
        "confidence_score": analysis["confidence_score"],
        "route_mode":       analysis["route_mode"],
        "summary_cloud":    analysis["summary_cloud"],
        # Mark as verified once cloud has processed it
        "status": "verified",
    }
    try:
        resp = client.table("incidents").update(patch).eq("id", incident_id).execute()
        if resp.data:
            log.info(
                "  [%s] ✓ updated — threat=%d  quality=%d  conf=%.2f  route=%s",
                incident_id,
                analysis["threat_score"],
                analysis["quality_score"],
                analysis["confidence_score"],
                analysis["route_mode"],
            )
            return True
        log.warning("  [%s] update returned no rows", incident_id)
        return False
    except Exception as exc:
        log.error("  [%s] DB update failed: %s", incident_id, exc)
        return False


def run_cloud_scan(model: YOLO, once: bool = False):
    """
    Queue-based cloud analysis worker.

    Architecture
    ────────────
    ┌─ scanner thread ─────────────────────────────────────────────┐
    │  Every SCAN_INTERVAL seconds:                                │
    │    • Query Supabase for pending CLOUD incidents              │
    │    • Push any new incident IDs onto the work queue           │
    │    • Skips IDs already queued or currently being processed   │
    └──────────────────────────────────────────────────────────────┘
                           ↓  queue
    ┌─ worker thread ──────────────────────────────────────────────┐
    │  For each incident ID popped from the queue:                 │
    │    1. Download clip.mp4 from Supabase Storage                │
    │    2. Run YOLO on every frame  (analyze_video_file)          │
    │    3. PATCH the incident row back (threat/quality/conf/route)│
    │    4. Status → "verified"  so the dashboard updates live     │
    └──────────────────────────────────────────────────────────────┘

    --cloud-scan-once  →  one scanner pass then drain queue and exit.
    --cloud-scan       →  runs forever (use as a background daemon).
    """
    client   = _supabase_client()
    work_q   : queue.Queue          = queue.Queue()
    queued   : set[str]             = set()   # IDs currently in queue or being processed
    q_lock   = threading.Lock()
    stop_evt = threading.Event()

    # ── scanner ─────────────────────────────────────────────────────────────
    def scanner():
        log.info("☁️  Scanner thread started (interval=%ds, batch=%d)", SCAN_INTERVAL, SCAN_BATCH_SIZE)
        while not stop_evt.is_set():
            try:
                rows = fetch_pending_cloud_incidents(client)
                new = 0
                for row in rows:
                    inc_id = row["id"]
                    with q_lock:
                        if inc_id not in queued:
                            queued.add(inc_id)
                            work_q.put(row)
                            new += 1
                if new:
                    log.info("🔍 Queued %d new incident(s)  (queue depth now %d)", new, work_q.qsize())
                else:
                    log.info("🔍 No new incidents found")
            except Exception as exc:
                log.error("Scanner error: %s", exc)

            if once:
                log.info("Single-pass scan done — waiting for worker to drain …")
                break

            stop_evt.wait(timeout=SCAN_INTERVAL)

    # ── worker ──────────────────────────────────────────────────────────────
    def worker():
        log.info("⚙️  Worker thread started")
        with tempfile.TemporaryDirectory(prefix="sentinelq_cloud_") as tmp:
            while True:
                # In once-mode, drain then exit; otherwise block until new work
                try:
                    timeout = 5 if once else None
                    row = work_q.get(timeout=timeout)
                except Exception:
                    # queue.Empty — we're in once-mode and queue is drained
                    if once:
                        log.info("⚙️  Queue empty — worker done")
                        break
                    continue

                inc_id = row["id"]
                log.info("→ [%s] Analysing  (route=%s, label=%s)",
                         inc_id, row.get("route_mode"), row.get("primary_label"))
                # task_done() + queued cleanup always happen in finally — no early calls
                try:
                    clip_path = download_clip(client, inc_id, tmp)
                    if clip_path is None:
                        log.warning("  [%s] clip unavailable — skipping", inc_id)
                    else:
                        analysis = analyze_video_file(clip_path, model)
                        if analysis is None:
                            log.warning("  [%s] video unreadable — skipping", inc_id)
                        else:
                            ok = update_incident(client, inc_id, analysis)
                            if ok:
                                log.info(
                                    "  [%s] ✅ Written back — threat=%d  quality=%d  conf=%.2f  route=CLOUD",
                                    inc_id,
                                    analysis["threat_score"],
                                    analysis["quality_score"],
                                    analysis["confidence_score"],
                                )
                        # Clean up temp clip to keep disk usage low
                        try:
                            os.remove(clip_path)
                        except OSError:
                            pass

                except Exception as exc:
                    log.error("  [%s] unexpected error: %s", inc_id, exc)
                finally:
                    # Always called exactly once per work_q.get()
                    work_q.task_done()
                    with q_lock:
                        queued.discard(inc_id)

        stop_evt.set()  # signal scanner to stop if not already done

    # ── launch ──────────────────────────────────────────────────────────────
    log.info("☁️  SentinelQ cloud worker starting  [once=%s]", once)
    t_scanner = threading.Thread(target=scanner, daemon=True, name="scanner")
    t_worker  = threading.Thread(target=worker,  daemon=False, name="worker")

    t_scanner.start()
    t_worker.start()

    try:
        t_worker.join()   # wait for the worker to drain and exit
    except KeyboardInterrupt:
        log.info("Interrupted — shutting down …")
        stop_evt.set()
        t_worker.join(timeout=10)

    log.info("☁️  Cloud worker finished")


# --- Main loop ------------------------------------
def main():
    parser = argparse.ArgumentParser(description="SentinelQ CV - run on webcam or video files")
    
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Video source: 0 for webcam, or path to a video file (mp4, avi, mov, mkv, etc.)"
    )
    parser.add_argument(
        "--cloud-scan",
        action="store_true",
        help=(
            "Poll Supabase for unanalysed CLOUD/LOCAL_VERIFY_CLOUD incidents, "
            "run the cloud model on each clip, and write results back. "
            "Requires SUPABASE_URL + SUPABASE_SERVICE_KEY env vars."
        ),
    )
    parser.add_argument(
        "--cloud-scan-once",
        action="store_true",
        help="Same as --cloud-scan but exits after a single pass (useful for cron jobs).",
    )
    
    args = parser.parse_args()

    # ── Cloud-scan mode ──────────────────────────────────────────────────────
    if args.cloud_scan or args.cloud_scan_once:
        model = YOLO(os.path.join(os.path.dirname(__file__), "yolov8n.pt"))
        run_cloud_scan(model, once=args.cloud_scan_once)
        return

    # ── Live-source mode (original behaviour) ────────────────────────────────
    if not args.source:
        parser.error("--source is required when not using --cloud-scan / --cloud-scan-once")
    
    if not os.path.isfile(args.source):
        raise FileNotFoundError(f"Video file not found: {args.source}")
    
    model = YOLO("yolov8n.pt")
    last_incident_time = 0
    
    cap = cv2.VideoCapture(args.source) # video capture device
    
    if not cap.isOpened():
        print(f"❌ Could not open video file: {args.source}")
        return
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    print(f"✅ Processing: {os.path.basename(args.source)} ({total_frames} frames @ {fps:.1f} fps)\n")
    
    frame_num = 0
    
    while True:
        ret, frame = cap.read() # read the current frame
        if not ret:
            print("Finished processing video.")
            break
        
        frame_num += 1
        print(f"\rFrame {frame_num}/{total_frames}", end="", flush=True)
        
        is_dark = is_low_light(frame)
        input_frame = enhance_frame(frame) if is_dark else frame
        
        results = model.predict(input_frame, verbose=False)
        result = results[0]
        
        if result.boxes is None:
            continue
        
        detections = []
        
        for box in result.boxes:
            cls_id = int(box.cls)
            conf = float(box.conf)
            
            if cls_id not in ALL_TRACKED or conf < CONFIDENCE_THRESHOLD:
                continue
            
            category = (
                "person" if cls_id in PERSON_CLASSES else
                "animal" if cls_id in ANIMAL_CLASSES else
                "vehicle"
            )
            
            detections.append({
                "label": ALL_TRACKED[cls_id],
                "category": category,
                "confience": round(conf, 3),
                "bbox": [round(x) for x in box.xyxy[0].tolist()],
                "track_id": None,
                "class_id": cls_id,
            })
            
        now = time.time()
        if detections and (now - last_incident_time) > COOLDOWN_SECONDS:
            post_incident(result, detections, is_dark)
            last_incident_time = now
        
        annotated = result.plot()
        cv2.imshow("SentinelQ", annotated)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
        
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    main()