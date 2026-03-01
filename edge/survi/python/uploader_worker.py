"""
uploader_worker.py  -  Supabase upload worker
══════════════════════════════════════════════════════════════════════════════

Watches events/final/ for completed event packages and pushes them to Supabase.

Two paths:

  LOCAL event (no NEEDS_CLOUD marker)
    → status = "stored"
    → uploads clip.mp4 + snapshots to Supabase Storage
    → inserts incident row + incident_media rows

  CLOUD event (has NEEDS_CLOUD marker)
    → status = "pending_cloud_verification"
    → uploads clip.mp4 to Supabase Storage (cloud runner needs the video)
    → inserts incident row with pending status
    → cloud runner polls for pending_cloud_verification rows,
      downloads clip, runs big model, updates the incident row

Environment variables required:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  DEFAULT_HUB_ID
  DEFAULT_CAMERA_ID

Optional:
  DEFAULT_ROUTE_MODE       (default: LOCAL)
  DEFAULT_STATUS           (default: stored)
  SUPABASE_STORAGE_BUCKET  (default: incidents)
  POLL_SECONDS             (default: 2)
  RUN_ONCE                 (set to 1 to exit after one pass)
"""

import os
import json
import time
import uuid
from pathlib import Path
from datetime import datetime, timezone

import requests

EVENTS_FINAL_DIR = Path("./events/final")
STATE_FILE       = Path("./events/supabase_uploaded.json")

SUPABASE_URL              = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

INCIDENTS_TABLE = os.environ.get("SUPABASE_INCIDENTS_TABLE", "incidents")
STORAGE_BUCKET  = os.environ.get("SUPABASE_STORAGE_BUCKET",  "incidents")

POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "2"))
RUN_ONCE     = os.environ.get("RUN_ONCE", "0") == "1"

DEFAULT_ROUTE_MODE = os.environ.get("DEFAULT_ROUTE_MODE", "LOCAL")
DEFAULT_STATUS     = os.environ.get("DEFAULT_STATUS",     "stored")

REST_INCIDENTS_URL = f"{SUPABASE_URL}/rest/v1/{INCIDENTS_TABLE}"
REST_MEDIA_URL     = f"{SUPABASE_URL}/rest/v1/incident_media"
STORAGE_UPLOAD_URL = f"{SUPABASE_URL}/storage/v1/object/{STORAGE_BUCKET}"
STORAGE_PUBLIC_URL = f"{SUPABASE_URL}/storage/v1/object/public/{STORAGE_BUCKET}"

HEADERS = {
    "apikey":        SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "return=representation",
}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except Exception as e:
        print(f"[ERR] Failed to parse {path}: {e}")
        return {}


def load_state() -> set:
    if not STATE_FILE.exists():
        return set()
    try:
        data = json.loads(STATE_FILE.read_text())
        if isinstance(data, list):
            return set(str(x) for x in data)
    except Exception as e:
        print(f"[WARN] Could not load state file: {e}")
    return set()


def save_state(done_ids: set) -> None:
    STATE_FILE.write_text(json.dumps(sorted(done_ids), indent=2))


def pick(*values, default=None):
    for v in values:
        if v is not None and v != "":
            return v
    return default


def to_int(v, default=None):
    try:
        if v is None or v == "":
            return default
        return int(float(v))
    except Exception:
        return default


def to_float(v, default=None):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except Exception:
        return default


def is_valid_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except Exception:
        return False


def clean_uuid(value, fallback=None):
    v = pick(value, fallback)
    if v is None:
        return None
    v = str(v).strip()
    if not v or v.startswith("PUT_"):
        return fallback if (fallback and is_valid_uuid(fallback)) else None
    if is_valid_uuid(v):
        return v
    return fallback if (fallback and is_valid_uuid(fallback)) else None


def clean_text(value, fallback=None):
    v = pick(value, fallback)
    if v is None:
        return fallback
    v = str(v).strip()
    return v if v else fallback


def normalize_route_mode(value) -> str:
    v = clean_text(value, DEFAULT_ROUTE_MODE)
    valid = {"LOCAL", "LOCAL_VERIFY_CLOUD", "CLOUD"}
    return v if v in valid else DEFAULT_ROUTE_MODE


# ─────────────────────────────────────────────────────────────────────────────
# Status logic  —  the core LOCAL vs CLOUD split
# ─────────────────────────────────────────────────────────────────────────────

def resolve_status(event_dir: Path, incident: dict, result: dict) -> str:
    """
    NEEDS_CLOUD file present         → pending_cloud_verification
    result.status == pending_cloud   → pending_cloud_verification
    routing.cloud_needed == True     → pending_cloud_verification
    Everything else                  → stored
    """
    if (event_dir / "NEEDS_CLOUD").exists():
        return "pending_cloud_verification"

    if (result.get("status") or "").lower() == "pending_cloud":
        return "pending_cloud_verification"

    if incident.get("routing", {}).get("cloud_needed") is True:
        return "pending_cloud_verification"

    return "stored"


# ─────────────────────────────────────────────────────────────────────────────
# Build Supabase row from event files
# ─────────────────────────────────────────────────────────────────────────────

def normalize_event(event_dir: Path) -> dict:
    incident = load_json(event_dir / "incident.json")
    result   = load_json(event_dir / "result.json")
    scores   = incident.get("scores", {})

    local_event_id = str(pick(
        incident.get("incident_id"),
        incident.get("id"),
        result.get("incident_id"),
        result.get("id"),
        event_dir.name,
    ))

    hub_id = clean_uuid(
        pick(incident.get("hub_id"), result.get("hub_id")),
        os.environ.get("DEFAULT_HUB_ID"),
    )

    camera_id = clean_uuid(
        pick(incident.get("camera_id"), result.get("camera_id")),
        os.environ.get("DEFAULT_CAMERA_ID"),
    )

    primary_label = clean_text(
        pick(
            incident.get("primary_label"),
            result.get("primary_label"),
            result.get("label"),
            incident.get("label"),
        ),
        "unknown",
    )

    started_at = pick(incident.get("started_at"), result.get("started_at"), now_iso())
    ended_at   = pick(incident.get("ended_at"),   result.get("ended_at"))

    status = resolve_status(event_dir, incident, result)

    threat_score = to_int(pick(
        scores.get("threat_score"),
        result.get("threat_score"),
        incident.get("threat_score"),
    ), default=0)

    quality_score = to_int(pick(
        scores.get("quality_score"),
        result.get("quality_score"),
        incident.get("quality_score"),
    ), default=None)

    confidence_score = to_float(pick(
        scores.get("confidence_score"),
        result.get("confidence_score"),
        incident.get("confidence_score"),
        result.get("confidence"),
    ), default=None)

    compute_pressure_score = to_int(pick(
        scores.get("compute_pressure_score"),
        result.get("compute_pressure_score"),
        incident.get("compute_pressure_score"),
    ), default=None)

    escalation_score = to_int(pick(
        scores.get("escalation_score"),
        result.get("escalation_score"),
        incident.get("escalation_score"),
    ), default=None)

    route_mode   = normalize_route_mode(pick(result.get("route_mode"),   incident.get("route_mode")))
    route_reason = clean_text(pick(incident.get("route_reason"), result.get("route_reason")), None)
    summary_local = clean_text(pick(result.get("summary_local"), incident.get("summary_local"), incident.get("summary")), None)
    summary_cloud = clean_text(pick(result.get("summary_cloud"), incident.get("summary_cloud")), None)

    row = {
        "camera_id":              camera_id,
        "hub_id":                 hub_id,
        "status":                 status,
        "primary_label":          primary_label,
        "started_at":             started_at,
        "ended_at":               ended_at,
        "threat_score":           threat_score,
        "quality_score":          quality_score,
        "confidence_score":       confidence_score,
        "compute_pressure_score": compute_pressure_score,
        "escalation_score":       escalation_score,
        "route_mode":             route_mode,
        "route_reason":           route_reason,
        "summary_local":          summary_local,
        "summary_cloud":          summary_cloud,
    }

    row = {k: v for k, v in row.items() if v is not None}

    return {
        "local_event_id": local_event_id,
        "incident_row":   row,
        "status":         status,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Supabase REST + Storage
# ─────────────────────────────────────────────────────────────────────────────

def insert_incident(row: dict) -> str:
    r = requests.post(REST_INCIDENTS_URL, headers=HEADERS, json=[row], timeout=20)
    if r.status_code >= 300:
        raise RuntimeError(f"incidents insert failed: {r.status_code} {r.text}")
    return r.json()[0]["id"]


def upload_file(local_path: Path, storage_path: str, content_type: str) -> str | None:
    if not local_path.exists():
        return None
    with open(local_path, "rb") as f:
        r = requests.post(
            f"{STORAGE_UPLOAD_URL}/{storage_path}",
            headers={
                "apikey":        SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type":  content_type,
                "x-upsert":      "true",
            },
            data=f,
            timeout=120,
        )
    if r.status_code >= 300:
        print(f"[ERR] Storage upload failed ({storage_path}): {r.status_code} {r.text}")
        return None
    return f"{STORAGE_PUBLIC_URL}/{storage_path}"


def insert_media(incident_db_id: str, storage_url: str,
                 media_type: str, content_type: str) -> None:
    row = {
        "incident_id":  incident_db_id,
        "media_type":   media_type,
        "storage_url":  storage_url,
        "content_type": content_type,
    }
    r = requests.post(REST_MEDIA_URL, headers=HEADERS, json=[row], timeout=20)
    if r.status_code >= 300:
        print(f"[ERR] incident_media insert failed: {r.status_code} {r.text}")


def upload_media_files(event_dir: Path, local_event_id: str,
                       incident_db_id: str, is_cloud: bool) -> None:
    """
    Always upload clip.mp4 — cloud runner needs the video for CLOUD events.
    Only upload snapshots/thumbnails for LOCAL events (already fully analyzed).
    """
    files = [("clip.mp4", "video/mp4", "clip")]

    if not is_cloud:
        files += [
            ("snapshot.jpg",  "image/jpeg", "snapshot"),
            ("snapshot.png",  "image/png",  "snapshot"),
            ("thumbnail.jpg", "image/jpeg", "thumbnail"),
            ("thumbnail.png", "image/png",  "thumbnail"),
        ]

    for filename, content_type, media_type in files:
        local_path = event_dir / filename
        if not local_path.exists():
            continue

        storage_path = f"{local_event_id}/{filename}"
        print(f"  [UPLOAD] {filename} -> {STORAGE_BUCKET}/{storage_path}")

        public_url = upload_file(local_path, storage_path, content_type)
        if public_url:
            insert_media(incident_db_id, public_url, media_type, content_type)
            print(f"  [OK]     {filename}")
        else:
            print(f"  [WARN]   {filename} upload failed")


# ─────────────────────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────────────────────

def process_event_dir(event_dir: Path, done_ids: set) -> bool:
    if not event_dir.is_dir():
        return False

    event_id = event_dir.name

    if not (event_dir / "DONE").exists():
        return False  # analysis_worker not finished yet

    if event_id in done_ids or (event_dir / "SUPABASE_DONE").exists():
        return False  # already uploaded

    if not (event_dir / "incident.json").exists() and \
       not (event_dir / "result.json").exists():
        print(f"[SKIP] {event_id}: no incident.json or result.json")
        return False

    norm           = normalize_event(event_dir)
    local_event_id = norm["local_event_id"]
    row            = norm["incident_row"]
    status         = norm["status"]
    is_cloud       = (status == "pending_cloud_verification")

    label = "CLOUD -> pending_cloud_verification" if is_cloud else "LOCAL -> stored"
    print(f"[PUSH] {local_event_id}  ({label})")

    incident_db_id = insert_incident(row)
    print(f"[OK]   db id={incident_db_id}")

    upload_media_files(event_dir, local_event_id, incident_db_id, is_cloud)

    done_ids.add(event_id)
    save_state(done_ids)
    (event_dir / "SUPABASE_DONE").write_text(now_iso())

    return True


def run_loop() -> None:
    print(f"[WORKER] watching       {EVENTS_FINAL_DIR}")
    print(f"[WORKER] incidents      {INCIDENTS_TABLE}")
    print(f"[WORKER] storage bucket {STORAGE_BUCKET}")
    print()

    done_ids = load_state()

    while True:
        pushed = 0

        if EVENTS_FINAL_DIR.exists():
            for event_dir in sorted(EVENTS_FINAL_DIR.iterdir()):
                try:
                    if process_event_dir(event_dir, done_ids):
                        pushed += 1
                except Exception as e:
                    print(f"[ERR] {event_dir.name}: {e}")

        if RUN_ONCE:
            break

        if pushed == 0:
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    run_loop()
