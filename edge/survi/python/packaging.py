# packaging.py
from __future__ import annotations
import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Optional


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def atomic_write_text(path: Path, text: str) -> None:
    ensure_dir(path.parent)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def atomic_write_json(path: Path, obj: Dict[str, Any]) -> None:
    atomic_write_text(path, json.dumps(obj, indent=2, sort_keys=True))


def safe_copy(src: Path, dst: Path) -> None:
    ensure_dir(dst.parent)
    tmp = dst.with_suffix(dst.suffix + ".tmp")
    shutil.copyfile(src, tmp)
    os.replace(tmp, dst)


def write_done_marker(incident_dir: Path) -> None:
    atomic_write_text(incident_dir / "DONE", "ok\n")


def finalize_incident_package(
    *,
    events_root: Path,
    incident_id: str,
    incident_json: Dict[str, Any],
    clip_path: Path,
    result_json: Optional[Dict[str, Any]] = None,
) -> Path:
    """
    Creates:
      events/final/<incident_id>/
        incident.json
        clip.mp4
        result.json (optional)
        DONE
    Writes DONE last.
    """
    final_dir = events_root / "final" / incident_id
    ensure_dir(final_dir)

    # Write incident.json atomically
    atomic_write_json(final_dir / "incident.json", incident_json)

    # Copy clip.mp4 atomically into the package
    safe_copy(clip_path, final_dir / "clip.mp4")

    # Optional result.json
    if result_json is not None:
        atomic_write_json(final_dir / "result.json", result_json)

    # DONE last
    write_done_marker(final_dir)
    return final_dir
