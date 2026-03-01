#!/usr/bin/env python3
"""
transcode_clips.py  –  SentinelQ one-time clip fixer
=====================================================
Runs on the Uno (or any machine with ffmpeg + the event folders).

What it does
------------
1. Walks every event folder under BASE_DIR that contains a clip.mp4
   encoded as mpeg4/mp4v (the codec browsers refuse to play).
2. Re-encodes each clip to H.264 + faststart so every browser <video>
   tag can stream it without downloading the whole file first.
3. Replaces the original clip.mp4 in-place.
4. (Optional) Re-uploads the fixed clip to Supabase Storage so the
   dashboard immediately picks it up.

Usage
-----
Copy this file to your Uno, then:

    # re-encode only (no re-upload):
    python3 transcode_clips.py

    # re-encode + re-upload to Supabase:
    SUPABASE_URL=https://xxxx.supabase.co \
    SUPABASE_SERVICE_KEY=your-service-role-key \
    python3 transcode_clips.py --upload

Requirements on the Uno
------------------------
    sudo apt install ffmpeg python3-pip -y
    pip3 install supabase            # only needed for --upload

"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────────

# Adjust to wherever your event folders live (final and/or uploaded)
BASE_DIRS = [
    Path.home() / "ArduinoApps" / "survillance" / "python" / "events" / "final",
    Path.home() / "ArduinoApps" / "survillance" / "python" / "events" / "uploaded",
]

# Supabase Storage bucket that holds the incident clips
BUCKET = "incidents"

# ffmpeg settings — H.264, yuv420p, veryfast, CRF 23, no audio, moov-at-front
FFMPEG_ARGS = [
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-crf", "23",
    "-movflags", "+faststart",
    "-an",              # drop audio track (surveillance clips have none)
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def is_mpeg4(path: Path) -> bool:
    """Return True if the clip is encoded as mpeg4/mp4v (needs re-encode)."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-hide_banner", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name",
                "-of", "default=nw=1",
                str(path),
            ],
            capture_output=True, text=True, check=True,
        )
        return "mpeg4" in result.stdout.lower()
    except subprocess.CalledProcessError:
        return False  # skip unreadable files


def transcode(src: Path) -> bool:
    """
    Re-encode src → H.264+faststart, atomically replacing it in-place.
    Returns True on success, False on failure.
    """
    tmp = src.with_suffix(".h264.tmp.mp4")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(src)] + FFMPEG_ARGS + [str(tmp)],
            check=True,
            capture_output=True,
        )
        tmp.replace(src)          # atomic rename
        print(f"  ✓  re-encoded  {src}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"  ✗  ffmpeg failed for {src}:\n{e.stderr.decode()[-300:]}")
        tmp.unlink(missing_ok=True)
        return False


def upload(clip_path: Path, supabase_url: str, service_key: str) -> bool:
    """Upload (upsert) clip_path to Supabase Storage as <folder>/clip.mp4."""
    try:
        from supabase import create_client  # type: ignore

        client = create_client(supabase_url, service_key)

        # folder name == the event timestamp directory name
        folder = clip_path.parent.name
        storage_path = f"{folder}/clip.mp4"

        with open(clip_path, "rb") as f:
            client.storage.from_(BUCKET).upload(
                path=storage_path,
                file=f,
                file_options={
                    "content-type": "video/mp4",
                    "upsert": "true",   # overwrite the existing mpeg4 version
                },
            )
        print(f"  ↑  uploaded    {storage_path}")
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"  ✗  upload failed for {clip_path}: {exc}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Re-encode SentinelQ clips to H.264")
    parser.add_argument(
        "--upload", action="store_true",
        help="Re-upload fixed clips to Supabase Storage after transcoding",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Re-encode ALL clips, not just the ones detected as mpeg4",
    )
    args = parser.parse_args()

    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key  = os.getenv("SUPABASE_SERVICE_KEY", "")
    if args.upload and not (supabase_url and service_key):
        print(
            "ERROR: --upload requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars.\n"
            "  export SUPABASE_URL=https://xxxx.supabase.co\n"
            "  export SUPABASE_SERVICE_KEY=your-service-role-key"
        )
        sys.exit(1)

    # Collect all clip.mp4 files from the base directories
    clips: list[Path] = []
    for base in BASE_DIRS:
        if base.exists():
            clips.extend(base.rglob("clip.mp4"))

    if not clips:
        print("No clip.mp4 files found in:\n" + "\n".join(str(b) for b in BASE_DIRS))
        return

    print(f"Found {len(clips)} clip(s) to check.\n")

    ok = fail = skipped = 0
    for clip in clips:
        if not args.all and not is_mpeg4(clip):
            skipped += 1
            continue

        print(f"Processing: {clip}")
        if transcode(clip):
            ok += 1
            if args.upload:
                upload(clip, supabase_url, service_key)
        else:
            fail += 1

    print(
        f"\nDone.  re-encoded={ok}  failed={fail}  already-h264-skipped={skipped}"
    )


if __name__ == "__main__":
    main()

