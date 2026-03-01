"""
main.py  –  Surveillance edge node
═══════════════════════════════════════════════════════════════════════════════

Frame pipeline
──────────────
  Camera
    → FrameRingQueue     JPEG ring, ~30 s rolling, auto-expire
    → SegmentRingBuffer  .mp4 micro-segments, pinned during events
    → MotionDetector     per-frame absdiff
    → EventFSM           idle ▶ active ▶ postroll ▶ [finalize] ▶ idle

  On event finalize:
    concat_mp4 → analysis_worker
                   ├─ COMPLETE  (local confidence ≥ threshold)
                   │       └─► events/final/  +  DONE  (uploader sends to cloud)
                   └─ INCOMPLETE (low confidence or RUN_CLOUD routed)
                           └─► events/final/  +  DONE  +  NEEDS_CLOUD
                               cloud_worker stages to events/cloud_pending/

Live feed
─────────
  /video.mjpg     multipart JPEG stream (all viewers)
  /frame.jpg      latest single JPEG snapshot   ← cloud can poll this
  /results.json   JSON live state
  /events         list finalised event packages
  /events/<id>.mp4 / .json / .result.json

Routing decision (per event, at event-start)
────────────────────────────────────────────
  RECORD_ONLY   dark / blurry  →  store clip, no inference
  RUN_LOCAL     normal path    →  local EI → COMPLETE or INCOMPLETE→cloud
  RUN_CLOUD     high CPU       →  skip local, straight to cloud_pending

Threads
───────
  capture_loop()    main: camera read, motion, segments, FSM
  analysis_worker() local EI + routing decision
  cloud_worker()    stages INCOMPLETE events for uploader
  start_server()    HTTP server
"""
from __future__ import annotations

import collections
import json
import os
import queue
import tempfile
import threading
import time
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse
from h264_postprocess import make_browser_ready

import cv2

from local_infer import run_local_ei_binary
from segment_buffer import SegmentRingBuffer, concat_mp4


# ═══════════════════════════════════════════════════════════════════════════
# Config
# ═══════════════════════════════════════════════════════════════════════════

def _load_cfg(path: str = "config.json") -> Dict[str, Any]:
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}

CFG = _load_cfg()

HUB_ID       = CFG.get("hub_id",       "HUB_UUID_MISSING")
CAMERA_ID    = CFG.get("camera_id",    "CAM_UUID_MISSING")
DEVICE_NAME  = CFG.get("device_name",  "UNO_Q")

HOST         = CFG.get("host",  "0.0.0.0")
PORT         = int(CFG.get("port", 8081))

CAM_INDEX    = CFG.get("cam_index", 0)
FRAME_W      = int(CFG.get("frame_w",   640))
FRAME_H      = int(CFG.get("frame_h",   360))
TARGET_FPS   = float(CFG.get("target_fps", 15.0))

# Motion
MOTION_AREA_MIN      = int(CFG.get("motion_area_min",      1200))
MOTION_PIX_THRESH    = int(CFG.get("motion_pixel_thresh",    25))
MOTION_DILATE_ITERS  = int(CFG.get("motion_dilate_iters",    2))
EVENT_ON_FRAMES      = int(CFG.get("event_on_frames",         3))
EVENT_OFF_SECONDS    = float(CFG.get("event_off_seconds",   2.0))

# Directories
RECORD_DIR   = CFG.get("record_dir", "./events")
SEG_DIR      = os.path.join(RECORD_DIR, "segments")
FINAL_DIR    = os.path.join(RECORD_DIR, "final")
UPLOADED_DIR = os.path.join(RECORD_DIR, "uploaded")
CLOUD_DIR    = os.path.join(RECORD_DIR, "cloud_pending")
EVENT_LOG    = os.path.join(RECORD_DIR, "event_log.jsonl")

RECORD_FOURCC    = CFG.get("record_fourcc",   "mp4v")
RECORD_FPS       = float(CFG.get("record_fps",   15.0))
SEGMENT_SECONDS  = float(CFG.get("segment_seconds", 1.0))
PREROLL_SECONDS  = float(CFG.get("preroll_seconds", 30.0))
POSTROLL_SECONDS = float(CFG.get("postroll_seconds",  3.0))
MAX_EVENT_SEC    = float(CFG.get("max_event_seconds", 300.0))
RING_KEEP_SEC    = PREROLL_SECONDS + MAX_EVENT_SEC + POSTROLL_SECONDS + 15

# Router thresholds
CLOUD_HEALTH_URL = os.environ.get("CLOUD_HEALTH_URL",
                                   CFG.get("cloud_health_url", "")).strip()
BRIGHTNESS_MIN   = float(CFG.get("brightness_min",   0.20))
BLUR_VAR_MIN     = float(CFG.get("blur_var_min",     60.0))
CPU_HIGH_PCT     = float(CFG.get("cpu_high_pct",     85.0))
NET_SLOW_MS      = float(CFG.get("net_slow_ms",     250.0))

# Local inference
LOCAL_INFER_FRAMES = int(os.environ.get(
    "LOCAL_INFER_FRAMES", str(CFG.get("local_infer_frames", 5))))
LOCAL_INFER_THRESH = float(os.environ.get(
    "LOCAL_INFER_THRESH", str(CFG.get("local_infer_thresh", 0.50))))

# Confidence threshold above which a local result is COMPLETE (no cloud needed)
COMPLETE_THRESH = float(CFG.get("complete_confidence_thresh", 0.70))

# How many seconds of raw frames to keep in the JPEG ring queue
FRAME_RING_SEC = float(CFG.get("frame_ring_seconds", 35.0))


# ═══════════════════════════════════════════════════════════════════════════
# Shared live state  (written by capture_loop, read by HTTP server)
# ═══════════════════════════════════════════════════════════════════════════

_state_lock = threading.Lock()

_latest_jpeg: Optional[bytes] = None
_latest_ts: float = 0.0

_live: Dict[str, Any] = {
    "ts": 0.0,
    "motion": False,
    "motion_boxes": [],
    "motion_area": 0,
    "event_id": None,
    "event_state": "idle",          # idle | active | postroll | analyzing
    "fps": 0.0,
    "decision": "RECORD_ONLY",
    "decision_reason": [],
    "quality": {"brightness": 0.0, "blur_var": 0.0},
    "network_ms": -1.0,
    "cpu_pct": -1.0,
    "last_clip": None,
    "last_result": None,
    "cloud_pending_count": 0,       # events staged for cloud but not yet sent
    "analyzing_count": 0,           # events currently under local EI
}

def _patch(patch: Dict[str, Any]) -> None:
    with _state_lock:
        _live.update(patch)


# ═══════════════════════════════════════════════════════════════════════════
# FrameRingQueue  -  rolling window of JPEG-compressed frames
# ═══════════════════════════════════════════════════════════════════════════

class FrameRingQueue:
    """
    Thread-safe rolling buffer of (timestamp, jpeg_bytes) tuples.

    Capacity is bounded by maxlen = max_seconds x fps.
    Oldest entries are automatically dropped when full.

    Usage
    -----
      frq = FrameRingQueue(max_seconds=35, fps=15)
      frq.push(time.time(), jpeg_bytes)
      recent = frq.snapshot_last(seconds=5)   # [(ts, bytes), ...]
    """

    def __init__(self, max_seconds: float = 35.0, fps: float = 15.0) -> None:
        cap = int(max_seconds * fps) + 32
        self._q: collections.deque[Tuple[float, bytes]] = collections.deque(maxlen=cap)
        self._lock = threading.Lock()
        self.max_seconds = max_seconds

    def push(self, ts: float, jpeg: bytes) -> None:
        with self._lock:
            self._q.append((ts, jpeg))

    def snapshot_last(self, seconds: float) -> List[Tuple[float, bytes]]:
        cutoff = time.time() - seconds
        with self._lock:
            return [(t, j) for t, j in self._q if t >= cutoff]

    def __len__(self) -> int:
        with self._lock:
            return len(self._q)


# ═══════════════════════════════════════════════════════════════════════════
# Utilities
# ═══════════════════════════════════════════════════════════════════════════

def _utc_iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()

def _now() -> float:
    return time.time()

def _ensure_dirs() -> None:
    for d in (RECORD_DIR, SEG_DIR, FINAL_DIR, UPLOADED_DIR, CLOUD_DIR):
        os.makedirs(d, exist_ok=True)

def _atomic_json(path: str, obj: dict) -> None:
    d = os.path.dirname(path) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".tmp_", suffix=".json", dir=d)
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(obj, f, indent=2)
            f.write("\n")
        os.replace(tmp, path)
    finally:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass

def _write_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        f.write(text)
    os.replace(tmp, path)

def _append_jsonl(path: str, obj: dict) -> None:
    try:
        with open(path, "a") as f:
            f.write(json.dumps(obj) + "\n")
    except Exception:
        pass

def _clamp_fps(loop_start: float, fps: float) -> None:
    if fps <= 0:
        return
    remaining = (1.0 / fps) - (_now() - loop_start)
    if remaining > 0:
        time.sleep(remaining)


# ═══════════════════════════════════════════════════════════════════════════
# Router signals
# ═══════════════════════════════════════════════════════════════════════════

def _brightness(frame) -> float:
    return float(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY).mean() / 255.0)

def _blur_var(frame) -> float:
    return float(cv2.Laplacian(
        cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())

def _cpu_pct() -> float:
    if not hasattr(_cpu_pct, "_p"):
        _cpu_pct._p = None
    try:
        with open("/proc/stat") as f:
            parts = f.readline().split()
        nums  = list(map(int, parts[1:]))
        idle  = nums[3] + (nums[4] if len(nums) > 4 else 0)
        total = sum(nums)
        prev  = _cpu_pct._p
        _cpu_pct._p = (total, idle)
        if prev is None:
            return -1.0
        dt = total - prev[0]
        if dt <= 0:
            return -1.0
        return float(100.0 * (1.0 - (idle - prev[1]) / dt))
    except Exception:
        return -1.0

def _net_latency(url: str, timeout: float = 0.6) -> float:
    t0 = _now()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            r.read(16)
        return float((_now() - t0) * 1000.0)
    except Exception:
        return -1.0

def _router(b: float, bl: float, cpu: float,
            net_ms: float, cloud_ok: bool) -> Tuple[str, List[str]]:
    """
    Returns (decision, reasons).
    decision in {"RECORD_ONLY", "RUN_LOCAL", "RUN_CLOUD"}

    NOTE: network is advisory only (does NOT force RUN_LOCAL).
    This lets you route to cloud based on CPU/quality even if cloud isn't configured yet.
    """
    reasons: List[str] = []

    # quality / compute signals
    if b   < BRIGHTNESS_MIN:            reasons.append("low_brightness")
    if bl  < BLUR_VAR_MIN:              reasons.append("blurry")
    if cpu >= 0 and cpu > CPU_HIGH_PCT: reasons.append("cpu_high")

    # network is recorded but doesn't block routing
    if not cloud_ok:
        reasons.append("net_unconfigured")
    elif net_ms < 0:
        reasons.append("net_down")
    elif net_ms > NET_SLOW_MS:
        reasons.append("net_slow")

    # extremely bad quality: don't bother
    if ("low_brightness" in reasons) and ("blurry" in reasons):
        return "RECORD_ONLY", reasons

    # choose cloud based on "other features"
    if ("cpu_high" in reasons) or ("blurry" in reasons) or ("low_brightness" in reasons):
        return "RUN_CLOUD", reasons

    return "RUN_LOCAL", reasons

# ═══════════════════════════════════════════════════════════════════════════
# Incident / result JSON builders
# ═══════════════════════════════════════════════════════════════════════════

def _make_incident(
    event_id: str, start_ts: float, end_ts: float,
    decision: str, d_reason: List[str],
    router_snap: dict, motion_stats: dict,
) -> dict:
    route_mode   = "CLOUD" if decision == "RUN_CLOUD" else "LOCAL"
    route_reason = d_reason[0] if d_reason else "router"
    threat_score = min(100, max(0, int(motion_stats.get("max_area", 0) / 80)))
    q_score      = int(min(100, max(0,
        router_snap.get("quality", {}).get("brightness", 0) * 100)))
    a_mode   = "none" if decision == "RECORD_ONLY" else \
               ("cloud" if decision == "RUN_CLOUD" else "local")
    a_status = "ok" if decision == "RECORD_ONLY" else "pending"
    cpu      = router_snap.get("cpu_pct", -1)

    return {
        "incident_id":   event_id,
        "hub_id":        HUB_ID,
        "camera_id":     CAMERA_ID,
        "primary_label": "motion_detected",
        "started_at":    _utc_iso(start_ts),
        "ended_at":      _utc_iso(end_ts),
        "route_mode":    route_mode,
        "route_reason":  route_reason,
        "scores": {
            "threat_score":           int(threat_score),
            "quality_score":          int(q_score),
            "confidence_score":       0.0,
            "compute_pressure_score": int(cpu) if isinstance(cpu, (int, float)) and cpu >= 0 else None,
            "escalation_score":       0,
        },
        "analysis": {
            "mode":        a_mode,
            "model":       None,
            "status":      a_status,
            "result_path": "result.json",
            "summary":     {"people": 0, "cars": 0},
            "latency_ms":  0,
        },
        "routing": {
            "complete":      None,   # filled after analysis_worker runs
            "cloud_needed":  decision == "RUN_CLOUD",
        },
        "raw": {
            "decision":        decision,
            "decision_reason": d_reason,
            "router":          router_snap,
            "motion":          motion_stats,
            "device":          {"name": DEVICE_NAME},
        },
        "schema_version": 1,
        "created_at":     datetime.now(timezone.utc).isoformat(),
    }


def _normalize_result(event_id: str, ei: dict) -> dict:
    status  = ei.get("status",     "ok")
    model   = ei.get("model",      "edgeimpulse_fomo_local")
    lat_ms  = int(ei.get("latency_ms", -1) or -1)
    summary = ei.get("summary") or {}
    dets    = ei.get("detections") if isinstance(ei.get("detections"), list) else []
    labels  = ei.get("labels")    if isinstance(ei.get("labels"),    list) else ["person", "car"]
    return {
        "status":       status,
        "model_name":   model,
        "model_stage":  "local_fast",
        "labels":       labels,
        "detections":   dets,
        "summary":      {
            "people": int(summary.get("people", 0) or 0),
            "cars":   int(summary.get("cars",   0) or 0),
        },
        "latency_ms":     lat_ms,
        "schema_version": 1,
        "event_id":       event_id,
        "created_at":     datetime.now(timezone.utc).isoformat(),
    }


def _is_complete(result: dict) -> bool:
    """
    COMPLETE   - local inference ran and is confident enough (no cloud needed).
    INCOMPLETE - error, pending_cloud, or max detection confidence < COMPLETE_THRESH.
    """
    if result.get("status") in ("error", "pending_cloud"):
        return False
    if result.get("status") == "skipped":
        return True  # RECORD_ONLY - nothing to escalate
    dets = result.get("detections", []) or []
    if not dets:
        # No objects found; nothing to escalate
        return True
    max_conf = max((float(d.get("value", 0.0) or 0.0) for d in dets), default=0.0)
    return max_conf >= COMPLETE_THRESH


# ═══════════════════════════════════════════════════════════════════════════
# Worker queues + tracking
# ═══════════════════════════════════════════════════════════════════════════

# {event_id, mp4, incident_json_path, out_result_path, decision}
_analysis_q: queue.Queue = queue.Queue(maxsize=64)

# {event_id, pkg_dir}
_cloud_q: queue.Queue = queue.Queue(maxsize=64)

_analyzing_ids:      set   = set()
_analyzing_lock            = threading.Lock()
_cloud_pending_count: int  = 0
_cloud_count_lock          = threading.Lock()


def _add_analyzing(eid: str) -> None:
    with _analyzing_lock:
        _analyzing_ids.add(eid)
    _patch({"analyzing_count": len(_analyzing_ids)})

def _remove_analyzing(eid: str) -> None:
    with _analyzing_lock:
        _analyzing_ids.discard(eid)
    _patch({"analyzing_count": len(_analyzing_ids)})


# ═══════════════════════════════════════════════════════════════════════════
# analysis_worker  -  local EI + routing
# ═══════════════════════════════════════════════════════════════════════════

def analysis_worker() -> None:
    """
    Pulls jobs from _analysis_q.

    Per-event pipeline
    ------------------
      RECORD_ONLY  -->  skip inference, mark COMPLETE immediately
      RUN_CLOUD    -->  skip local EI, mark INCOMPLETE -> cloud_q
      RUN_LOCAL    -->  run EI binary
                          max_conf >= COMPLETE_THRESH  -->  COMPLETE
                          max_conf <  COMPLETE_THRESH  -->  INCOMPLETE -> cloud_q

    Both paths write a DONE marker so the uploader can ingest the package.
    INCOMPLETE packages also get a NEEDS_CLOUD marker so the uploader knows
    to request stronger cloud inference.
    """
    while True:
        job = _analysis_q.get()
        if job is None:
            return

        event_id    = job["event_id"]
        mp4         = job["mp4"]
        inc_path    = job["incident_json_path"]
        result_path = job["out_result_path"]
        decision    = job["decision"]
        pkg_dir     = os.path.dirname(inc_path)

        try:
            # ── Run inference ────────────────────────────────────────────
            if decision == "RECORD_ONLY":
                result = {
                    "status": "skipped", "model_name": "none",
                    "model_stage": "none", "labels": [],
                    "detections": [], "summary": {"people": 0, "cars": 0},
                    "latency_ms": 0, "schema_version": 1,
                    "event_id": event_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                complete = True

            elif decision == "RUN_CLOUD":
                result = {
                    "status": "pending_cloud", "model_name": "cloud",
                    "model_stage": "cloud_verify", "labels": ["person", "car"],
                    "detections": [], "summary": {"people": 0, "cars": 0},
                    "latency_ms": 0, "schema_version": 1,
                    "event_id": event_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
                complete = False

            else:   # RUN_LOCAL
                ei       = run_local_ei_binary(
                    event_id=event_id, mp4_path=mp4,
                    out_path=result_path,
                    frames=LOCAL_INFER_FRAMES,
                    threshold=LOCAL_INFER_THRESH,
                )
                result   = _normalize_result(event_id, ei)
                complete = _is_complete(result)

            _atomic_json(result_path, result)

            # ── Update incident.json ──────────────────────────────────────
            try:
                with open(inc_path) as f:
                    inc = json.load(f)
            except Exception:
                inc = {"incident_id": event_id}

            summary = result.get("summary", {"people": 0, "cars": 0})
            inc.setdefault("analysis", {}).update({
                "mode":       result.get("model_stage", "local"),
                "model":      result.get("model_name"),
                "status":     result.get("status", "ok"),
                "summary":    summary,
                "latency_ms": result.get("latency_ms", -1),
            })
            if "scores" in inc:
                has_det = bool(summary.get("people") or summary.get("cars"))
                inc["scores"]["confidence_score"] = 1.0 if has_det else 0.0
            inc.setdefault("routing", {}).update({
                "complete":    complete,
                "cloud_needed": not complete,
            })
            _atomic_json(inc_path, inc)

            # ── Route ─────────────────────────────────────────────────────
            if complete:
                # Ready for uploader to send upstream
                _write_text(os.path.join(pkg_dir, "DONE"), "ok\n")
                print(f"[ANALYSIS] COMPLETE  id={event_id}  "
                      f"people={summary.get('people')}  cars={summary.get('cars')}")
            else:
                # DONE so uploader ingests; NEEDS_CLOUD so it knows to request re-analysis
                _write_text(os.path.join(pkg_dir, "DONE"),       "ok\n")
                _write_text(os.path.join(pkg_dir, "NEEDS_CLOUD"), "ok\n")
                try:
                    _cloud_q.put_nowait({"event_id": event_id, "pkg_dir": pkg_dir})
                except queue.Full:
                    print(f"[ANALYSIS] cloud_q full; {event_id} queued without cloud job")
                print(f"[ANALYSIS] INCOMPLETE->cloud  id={event_id}  "
                      f"status={result.get('status')}")

            _patch({"last_result": result_path})

        except Exception as exc:
            print(f"[ANALYSIS] FAILED  id={event_id}: {exc}")
            fail = {
                "status": "error", "model_name": "edgeimpulse_fomo_local",
                "model_stage": "local_fast", "labels": ["person", "car"],
                "detections": [], "summary": {"people": 0, "cars": 0},
                "latency_ms": -1, "error": str(exc)[:800],
                "schema_version": 1, "event_id": event_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            try:
                _atomic_json(result_path, fail)
            except Exception:
                pass
            # Always write DONE so uploader never stalls on this package
            try:
                _write_text(os.path.join(pkg_dir, "DONE"), "ok\n")
            except Exception:
                pass

        finally:
            _remove_analyzing(event_id)
            _analysis_q.task_done()


# ═══════════════════════════════════════════════════════════════════════════
# cloud_worker  -  stages INCOMPLETE events for the uploader
# ═══════════════════════════════════════════════════════════════════════════

def cloud_worker() -> None:
    """
    Writes a cloud_job.json pointer into events/cloud_pending/<id>/.
    uploader.py scans that directory and POSTs the package to the cloud API,
    which runs a stronger model and writes back result.json.
    """
    global _cloud_pending_count

    while True:
        try:
            job = _cloud_q.get(timeout=5.0)
        except queue.Empty:
            continue

        if job is None:
            return

        event_id = job["event_id"]
        pkg_dir  = job["pkg_dir"]

        try:
            cloud_dir = os.path.join(CLOUD_DIR, event_id)
            os.makedirs(cloud_dir, exist_ok=True)

            _atomic_json(os.path.join(cloud_dir, "cloud_job.json"), {
                "event_id":   event_id,
                "pkg_dir":    pkg_dir,
                "queued_at":  datetime.now(timezone.utc).isoformat(),
                "reason":     "local_incomplete",
            })

            with _cloud_count_lock:
                _cloud_pending_count += 1
            _patch({"cloud_pending_count": _cloud_pending_count})
            print(f"[CLOUD] staged  id={event_id}  pending={_cloud_pending_count}")

        except Exception as exc:
            print(f"[CLOUD] staging failed  id={event_id}: {exc}")

        finally:
            _cloud_q.task_done()


# ═══════════════════════════════════════════════════════════════════════════
# HTTP helpers
# ═══════════════════════════════════════════════════════════════════════════

def _json_resp(h: BaseHTTPRequestHandler, obj: dict, code: int = 200) -> None:
    body = json.dumps(obj, indent=2).encode()
    h.send_response(code)
    h.send_header("Content-Type", "application/json; charset=utf-8")
    h.send_header("Cache-Control", "no-store")
    h.end_headers()
    h.wfile.write(body)


def _send_file(h: BaseHTTPRequestHandler, path: str, ctype: str) -> None:
    """Serve a file with graceful BrokenPipe handling."""
    try:
        size = os.path.getsize(path)
        h.send_response(200)
        h.send_header("Content-Type",   ctype)
        h.send_header("Content-Length", str(size))
        h.send_header("Cache-Control",  "no-store")
        h.end_headers()
        with open(path, "rb") as f:
            while True:
                chunk = f.read(256 * 1024)
                if not chunk:
                    break
                try:
                    h.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
    except (BrokenPipeError, ConnectionResetError):
        return
    except FileNotFoundError:
        try:
            h.send_response(404)
            h.end_headers()
            h.wfile.write(b"Not found\n")
        except Exception:
            pass
    except Exception:
        try:
            h.send_response(500)
            h.end_headers()
        except Exception:
            pass


def _list_pkgs(base: str, limit: int = 50) -> List[dict]:
    items = []
    try:
        for name in os.listdir(base):
            d = os.path.join(base, name)
            if not os.path.isdir(d):
                continue
            inc  = os.path.join(d, "incident.json")
            clip = os.path.join(d, "clip.mp4")
            if not (os.path.exists(inc) and os.path.exists(clip)):
                continue
            items.append((os.path.getmtime(inc), name))
    except FileNotFoundError:
        return []
    items.sort(reverse=True)
    out = []
    for _, eid in items[:limit]:
        d = os.path.join(base, eid)
        out.append({
            "event_id":    eid,
            "json_path":   os.path.join(d, "incident.json"),
            "mp4_path":    os.path.join(d, "clip.mp4"),
            "result_path": os.path.join(d, "result.json"),
            "has_result":  os.path.exists(os.path.join(d, "result.json")),
            "needs_cloud": os.path.exists(os.path.join(d, "NEEDS_CLOUD")),
            "done":        os.path.exists(os.path.join(d, "DONE")),
        })
    return out


def _find_pkg(event_id: str) -> Optional[str]:
    for base in (UPLOADED_DIR, FINAL_DIR):
        p = os.path.join(base, event_id)
        if os.path.isdir(p) and os.path.exists(os.path.join(p, "incident.json")):
            return p
    return None


# ═══════════════════════════════════════════════════════════════════════════
# HTTP server
# ═══════════════════════════════════════════════════════════════════════════

class _Handler(BaseHTTPRequestHandler):

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        p      = parsed.path

        # /health
        if p == "/health":
            return _json_resp(self, {"ok": True})

        # /results.json  (live state snapshot)
        if p == "/results.json":
            with _state_lock:
                body = json.dumps(_live).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        # /video.mjpg  (MJPEG multipart live stream)
        if p == "/video.mjpg":
            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-store, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Type",
                             "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                while True:
                    with _state_lock:
                        frame = _latest_jpeg
                        ts    = _latest_ts
                    if frame is None:
                        time.sleep(0.05)
                        continue
                    try:
                        self.wfile.write(
                            b"--frame\r\n"
                            b"Content-Type: image/jpeg\r\n"
                            + f"Content-Length: {len(frame)}\r\n".encode()
                            + f"X-Timestamp: {ts}\r\n\r\n".encode()
                            + frame + b"\r\n"
                        )
                    except (BrokenPipeError, ConnectionResetError):
                        return
                    time.sleep(1.0 / TARGET_FPS)
            except Exception:
                return

        # /frame.jpg  (single JPEG snapshot - cloud can poll this for live feed)
        if p == "/frame.jpg":
            with _state_lock:
                frame = _latest_jpeg
            if frame is None:
                self.send_response(503)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type",   "image/jpeg")
            self.send_header("Content-Length", str(len(frame)))
            self.send_header("Cache-Control",  "no-store")
            self.end_headers()
            try:
                self.wfile.write(frame)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return

        # /events  (list all finalised packages)
        if p == "/events":
            limit = 50
            try:
                for kv in (parsed.query or "").split("&"):
                    if not kv:
                        continue
                    k, v = (kv.split("=", 1) + [""])[:2]
                    if k == "limit":
                        limit = max(1, min(200, int(v)))
            except Exception:
                pass
            final  = [{"bucket": "final",    **e} for e in _list_pkgs(FINAL_DIR,   limit)]
            upl    = [{"bucket": "uploaded", **e} for e in _list_pkgs(UPLOADED_DIR, limit)]
            merged = final + upl
            try:
                merged.sort(key=lambda x: int(x["event_id"]), reverse=True)
            except Exception:
                pass
            return _json_resp(self, {"count": len(merged), "events": merged[:limit]})

        # /events/<id>.json
        if p.startswith("/events/") and p.endswith(".json") and \
                not p.endswith(".result.json"):
            eid = unquote(p[len("/events/"):-len(".json")])
            pkg = _find_pkg(eid)
            if not pkg:
                return _json_resp(self, {"error": "not_found"}, 404)
            return _send_file(self, os.path.join(pkg, "incident.json"),
                              "application/json")

        # /events/<id>.result.json
        if p.startswith("/events/") and p.endswith(".result.json"):
            eid = unquote(p[len("/events/"):-len(".result.json")])
            pkg = _find_pkg(eid)
            if not pkg:
                return _json_resp(self, {"error": "not_found"}, 404)
            rp = os.path.join(pkg, "result.json")
            if not os.path.exists(rp):
                return _json_resp(self, {"error": "result_not_ready"}, 404)
            return _send_file(self, rp, "application/json")

        # /events/<id>.mp4
        if p.startswith("/events/") and p.endswith(".mp4"):
            eid = unquote(p[len("/events/"):-len(".mp4")])
            pkg = _find_pkg(eid)
            if not pkg:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not found\n")
                return
            mp4 = os.path.join(pkg, "clip.mp4")
            if not os.path.exists(mp4):
                return _json_resp(self, {"error": "not_found"}, 404)
            return _send_file(self, mp4, "video/mp4")

        # 404
        self.send_response(404)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Not found\n")

    def log_message(self, fmt, *args) -> None:
        pass  # suppress per-request console noise


class _Server(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def start_server() -> None:
    srv = _Server((HOST, PORT), _Handler)
    print(f"[HTTP] http://{HOST}:{PORT}")
    print(f"       MJPEG    /video.mjpg")
    print(f"       Snapshot /frame.jpg")
    print(f"       State    /results.json")
    print(f"       Events   /events")
    srv.serve_forever()


# ═══════════════════════════════════════════════════════════════════════════
# capture_loop  -  camera . motion . event FSM . frame ring . segments
# ═══════════════════════════════════════════════════════════════════════════

def capture_loop() -> None:
    """
    Runs on the main thread. Reads camera frames at TARGET_FPS.

    Per-frame work
    --------------
    1. Resize + encode JPEG
       -> push to FrameRingQueue (rolling 30s window)
       -> update _latest_jpeg (MJPEG + /frame.jpg)

    2. Write raw frame to current MP4 segment;
       roll segment every SEGMENT_SECONDS

    3. Sample brightness / blur / CPU / net -> 10-frame rolling averages
       -> router decision (RECORD_ONLY / RUN_LOCAL / RUN_CLOUD)

    4. Motion detection (absdiff + contours)

    5. Event FSM
         idle  --(streak>=N)--> active
         active --(quiet)-----> postroll
         postroll --(timer)---> finalize -> idle   (analysis runs async)
         postroll --(motion)---> active            (elongation / retrigger)

       On finalize:
         concat_mp4 -> write incident.json -> queue to analysis_worker
         analysis_worker decides COMPLETE vs INCOMPLETE (-> cloud_worker)
    """
    global _latest_jpeg, _latest_ts

    _ensure_dirs()
    
    #cap = cv2.VideoCapture(os.environ.get("VIDEO_DEVICE", CAM_INDEX), cv2.CAP_V4L2)
    #cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))

    src = os.environ.get("VIDEO_DEVICE", str(CAM_INDEX))

    # A llow VIDEO_DEVICE="4" or VIDEO_DEVICE="/dev/video4"
    if isinstance(src, str) and src.startswith("/dev/video") and src[len("/dev/video"):].isdigit():
        src = src[len("/dev/video"):]
    if isinstance(src, str) and src.isdigit():
        src = int(src)

    cap = cv2.VideoCapture(src, cv2.CAP_V4L2)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))


    if not cap.isOpened():
        raise RuntimeError(f"Cannot open camera index {CAM_INDEX}")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_FPS,          TARGET_FPS)

    # ── Frame ring queue (JPEG frames, auto-expire) ───────────────────────
    frq = FrameRingQueue(max_seconds=FRAME_RING_SEC, fps=TARGET_FPS)

    # ── Segment ring buffer (MP4 files, pinned during events) ─────────────
    seg_rb     = SegmentRingBuffer(SEG_DIR, keep_seconds=RING_KEEP_SEC)
    seg_writer = None
    seg_path:  Optional[str] = None
    seg_start: float = 0.0
    fourcc     = cv2.VideoWriter_fourcc(*RECORD_FOURCC)

    def seg_open(ts: float) -> None:
        nonlocal seg_writer, seg_path, seg_start
        seg_start  = ts
        seg_path   = os.path.join(SEG_DIR, f"seg_{int(ts * 1000)}.mp4")
        seg_writer = cv2.VideoWriter(seg_path, fourcc, RECORD_FPS, (FRAME_W, FRAME_H))
        if not seg_writer.isOpened():
            print("[SEG] VideoWriter failed - check RECORD_FOURCC in config.json")
            seg_writer = None

    def seg_close_commit() -> None:
        """Release current segment, add to ring, pin if event is active."""
        nonlocal seg_writer, seg_path, seg_start
        if seg_writer is None:
            return
        seg_writer.release()
        seg_writer = None
        try:
            if os.path.exists(seg_path) and os.path.getsize(seg_path) > 1024:
                seg_rb.add(seg_start, seg_path)
                if evt_state in ("active", "postroll"):
                    evt_segs.append(seg_path)
                    seg_rb.pin_many([seg_path])
        except Exception:
            pass

    # ── Motion state ──────────────────────────────────────────────────────
    prev_gray: Optional[Any] = None
    motion_streak  = 0
    last_motion_ts = 0.0

    # ── Event FSM variables ───────────────────────────────────────────────
    evt_state     = "idle"
    evt_id:       Optional[str] = None
    evt_start     = 0.0
    evt_end       = 0.0
    evt_segs:     List[str] = []
    evt_preroll:  List[str] = []
    postroll_until = 0.0

    evt_decision        = "RECORD_ONLY"
    evt_decision_reason: List[str] = []
    evt_router_snap:    dict = {}

    # per-event motion stats (reset on each START)
    s_max_area   = 0
    s_sum_area   = 0
    s_samples    = 0
    s_boxes_peak = 0
    s_motion_frm = 0
    s_event_frm  = 0

    # ── Rolling signal histories (10 frames) ──────────────────────────────
    HIST = 10
    b_hist:   List[float] = []
    bl_hist:  List[float] = []
    cpu_hist: List[float] = []
    net_hist: List[float] = []

    def push_h(h: list, v: float) -> None:
        h.append(v)
        if len(h) > HIST:
            h.pop(0)

    def avg_h(h: list) -> float:
        vals = [x for x in h if x is not None and x >= 0]
        return (sum(vals) / len(vals)) if vals else -1.0

    last_net_check  = 0.0
    net_ms          = -1.0
    cloud_configured = bool(CLOUD_HEALTH_URL)

    # ── FPS counter ───────────────────────────────────────────────────────
    frm_count  = 0
    fps_epoch  = _now()
    current_fps = 0.0

    # ═════════════════════════════════════════════════════════════════════
    # Main frame loop
    # ═════════════════════════════════════════════════════════════════════
    while True:
        loop_ts = _now()

        ok, frame = cap.read()
        if not ok or frame is None:
            time.sleep(0.05)
            continue

        frame = cv2.resize(frame, (FRAME_W, FRAME_H), cv2.INTER_AREA)
        ts    = _now()

        # ── 1. Segment writer ─────────────────────────────────────────────
        if seg_writer is None:
            seg_open(ts)
        if seg_writer is not None:
            seg_writer.write(frame)
            if (ts - seg_start) >= SEGMENT_SECONDS:
                seg_close_commit()

        # ── 2. Router signals ─────────────────────────────────────────────
        b   = _brightness(frame)
        bl  = _blur_var(frame)
        cpu = _cpu_pct()
        push_h(b_hist,   b)
        push_h(bl_hist,  bl)
        push_h(cpu_hist, cpu)

        if cloud_configured and (ts - last_net_check) > 2.0:
            last_net_check = ts
            net_ms = _net_latency(CLOUD_HEALTH_URL)
        if not cloud_configured:
            net_ms = -1.0
        push_h(net_hist, net_ms)

        b_avg   = avg_h(b_hist)
        bl_avg  = avg_h(bl_hist)
        cpu_avg = avg_h(cpu_hist)
        net_avg = avg_h(net_hist)

        decision, d_reason = _router(b_avg, bl_avg, cpu_avg, net_avg,
                                     cloud_configured)

        # ── 3. Motion detection ───────────────────────────────────────────
        gray = cv2.GaussianBlur(
            cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (9, 9), 0)

        motion = False
        boxes: List = []
        total_area = 0

        if prev_gray is not None:
            diff = cv2.absdiff(prev_gray, gray)
            _, thresh = cv2.threshold(
                diff, MOTION_PIX_THRESH, 255, cv2.THRESH_BINARY)
            thresh = cv2.dilate(thresh, None, iterations=MOTION_DILATE_ITERS)
            for c in cv2.findContours(
                    thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]:
                area = cv2.contourArea(c)
                if area < MOTION_AREA_MIN:
                    continue
                x, y, w, h = cv2.boundingRect(c)
                boxes.append([int(x), int(y), int(w), int(h)])
                total_area += int(area)
            motion = bool(boxes)

        prev_gray = gray

        if motion:
            motion_streak  += 1
            last_motion_ts  = ts
        else:
            motion_streak = max(0, motion_streak - 1)

        # ── 4. Event FSM ──────────────────────────────────────────────────

        # idle -> active
        if evt_state == "idle" and motion_streak >= EVENT_ON_FRAMES:
            evt_state  = "active"
            evt_id     = str(int(ts * 1000))
            evt_start  = ts
            evt_preroll = seg_rb.snapshot_last(PREROLL_SECONDS)
            evt_segs    = []
            postroll_until = 0.0

            s_max_area = s_sum_area = s_samples = 0
            s_boxes_peak = s_motion_frm = s_event_frm = 0

            evt_decision        = decision
            evt_decision_reason = list(d_reason)
            evt_router_snap     = {
                "quality":          {"brightness": round(b_avg, 3),
                                     "blur_var":   round(bl_avg,  1)},
                "network_ms":       round(net_avg, 1) if net_avg >= 0 else -1,
                "cpu_pct":          round(cpu_avg, 1) if cpu_avg >= 0 else -1,
                "cloud_health_url": CLOUD_HEALTH_URL if cloud_configured else None,
            }

            seg_rb.pin_many(evt_preroll)
            print(f"[EVENT] START  id={evt_id}  preroll_segs={len(evt_preroll)}  "
                  f"decision={evt_decision}")

        # accumulate stats while active
        if evt_state == "active":
            s_event_frm += 1
            s_samples   += 1
            s_sum_area  += int(total_area)
            s_max_area   = max(s_max_area,   int(total_area))
            s_boxes_peak = max(s_boxes_peak, len(boxes))
            if motion:
                s_motion_frm += 1

        # postroll -> re-active  (motion returned = elongate)
        if evt_state == "postroll" and motion_streak >= EVENT_ON_FRAMES:
            evt_state = "active"
            print(f"[EVENT] RETRIGGERED  id={evt_id}")

        # active -> postroll  (quiet for EVENT_OFF_SECONDS)
        if evt_state == "active" and (ts - last_motion_ts) >= EVENT_OFF_SECONDS:
            evt_state      = "postroll"
            postroll_until = ts + POSTROLL_SECONDS
            print(f"[EVENT] END->POSTROLL  id={evt_id}  until={postroll_until:.2f}")

        # postroll -> finalize (timer expired)
        if evt_state == "postroll" and ts >= postroll_until:
            evt_end  = ts
            _eid     = evt_id  # local copy for async worker

            seg_close_commit()
            postroll_segs = seg_rb.snapshot_last(POSTROLL_SECONDS + 1)
            seg_rb.pin_many(postroll_segs)

            all_segs = evt_preroll + evt_segs + postroll_segs
            pkg_dir  = os.path.join(FINAL_DIR, _eid)
            os.makedirs(pkg_dir, exist_ok=True)

            out_mp4    = os.path.join(pkg_dir, "clip.mp4")
            out_inc    = os.path.join(pkg_dir, "incident.json")
            out_result = os.path.join(pkg_dir, "result.json")

            ok_concat = concat_mp4(out_mp4, all_segs)

            if ok_concat:
                make_browser_ready(out_mp4)
                avg_area     = (s_sum_area / s_samples) if s_samples else 0.0
                motion_stats = {
                    "max_area":       int(s_max_area),
                    "avg_area":       round(avg_area, 2),
                    "num_boxes_peak": int(s_boxes_peak),
                    "motion_frames":  int(s_motion_frm),
                    "event_frames":   int(s_event_frm),
                }
                inc = _make_incident(
                    event_id=_eid,
                    start_ts=evt_start, end_ts=evt_end,
                    decision=evt_decision,
                    d_reason=evt_decision_reason,
                    router_snap=evt_router_snap,
                    motion_stats=motion_stats,
                )
                _atomic_json(out_inc, inc)
                _append_jsonl(EVENT_LOG, inc)

                print(f"[PKG] {pkg_dir}  segs={len(all_segs)}")

                # Queue for local EI (runs async - does not block capture)
                _add_analyzing(_eid)
                try:
                    _analysis_q.put_nowait({
                        "event_id":           _eid,
                        "mp4":                out_mp4,
                        "incident_json_path": out_inc,
                        "out_result_path":    out_result,
                        "decision":           evt_decision,
                    })
                    print(f"[ANALYSIS] queued  id={_eid}")
                except queue.Full:
                    print(f"[ANALYSIS] queue full - writing DONE without EI  id={_eid}")
                    _remove_analyzing(_eid)
                    _write_text(os.path.join(pkg_dir, "DONE"), "ok\n")

                _patch({"last_clip": out_mp4})
            else:
                print(f"[PKG] concat FAILED  id={_eid}  segs={len(all_segs)}")

            # Unpin; ring buffer can evict these segments now
            seg_rb.unpin_many(evt_preroll)
            seg_rb.unpin_many(evt_segs)
            seg_rb.unpin_many(postroll_segs)

            # Reset FSM - analysis_worker continues independently
            evt_state      = "idle"
            evt_id         = None
            evt_preroll    = []
            evt_segs       = []
            postroll_until = 0.0

        # ── 5. Annotate frame + encode JPEG ──────────────────────────────
        for x, y, w, h in boxes:
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

        overlay = (
            f"motion={int(motion)} boxes={len(boxes)} "
            f"state={evt_state} id={evt_id or '-'} "
            f"fps={current_fps:.1f} {decision}"
        )
        cv2.putText(frame, overlay, (10, 24),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

        ok_j, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if ok_j:
            jpg_bytes = jpg.tobytes()

            # Push to FrameRingQueue
            # analysis_worker / cloud_worker can call frq.snapshot_last(N)
            # to grab recent frames for per-frame cloud inference.
            # When an event is active, every frame is preserved here for
            # as long as FRAME_RING_SEC seconds (>= max event length).
            frq.push(ts, jpg_bytes)

            # Update live feed
            # All MJPEG clients read from _latest_jpeg.
            # /frame.jpg polls the same value.
            # Hook: when cloud is wired up, push jpg_bytes to your Supabase
            # realtime channel here (e.g. every 1 s, or on every event frame).
            with _state_lock:
                _latest_jpeg = jpg_bytes
                _latest_ts   = ts

        # ── FPS counter ───────────────────────────────────────────────────
        frm_count += 1
        elapsed = ts - fps_epoch
        if elapsed >= 2.0:
            current_fps = frm_count / elapsed
            frm_count   = 0
            fps_epoch   = ts

        # ── Live state patch ──────────────────────────────────────────────
        _patch({
            "ts":             ts,
            "motion":         bool(motion),
            "motion_boxes":   boxes,
            "motion_area":    int(total_area),
            "event_id":       evt_id,
            "event_state":    evt_state,
            "fps":            round(current_fps, 2),
            "decision":       decision,
            "decision_reason": d_reason,
            "quality":        {"brightness": round(b_avg, 3),
                               "blur_var":   round(bl_avg,  1)},
            "network_ms":     round(net_avg, 1) if net_avg >= 0 else -1,
            "cpu_pct":        round(cpu_avg, 1) if cpu_avg >= 0 else -1,
        })

        _clamp_fps(loop_ts, TARGET_FPS)


# ═══════════════════════════════════════════════════════════════════════════
# Entry point
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    _ensure_dirs()
    threading.Thread(target=start_server,    daemon=True, name="http").start()
    threading.Thread(target=analysis_worker, daemon=True, name="analysis").start()
    threading.Thread(target=cloud_worker,    daemon=True, name="cloud").start()
    capture_loop()   # blocks forever on the main thread


if __name__ == "__main__":
    main()
