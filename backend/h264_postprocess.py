"""
h264_postprocess.py  –  drop-in helper for the SentinelQ pipeline
==================================================================
After concat_mp4() writes out_mp4 as mpeg4/mp4v, call:

    from h264_postprocess import make_browser_ready
    make_browser_ready(out_mp4)          # re-encodes in-place → H.264 + faststart

That's the only change you need in main.py (or segment_buffer.py).

How to integrate
----------------
In the file that calls concat_mp4 (likely segment_buffer.py or main.py),
find the line that looks like:

    concat_mp4(out_mp4, all_segs)

And change it to:

    concat_mp4(out_mp4, all_segs)
    from h264_postprocess import make_browser_ready   # add this line once at top
    make_browser_ready(out_mp4)                       # add this line after concat

Or add the import at the top of the file and just add the one call after concat.

Requirements
------------
    sudo apt install ffmpeg -y      # already present on most Pi/Uno setups
"""

import logging
import os
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

# ffmpeg settings that guarantee <video> playback in every browser
_FFMPEG_ENCODE_ARGS = [
    "-c:v", "libx264",      # H.264 — universally supported
    "-pix_fmt", "yuv420p",  # broadest decoder compatibility
    "-preset", "veryfast",  # fast enough for real-time; ~2–4 s for a 30-s clip
    "-crf", "23",           # visually lossless quality
    "-movflags", "+faststart",  # move moov atom to front → instant browser seek
    "-an",                  # no audio (surveillance clips are silent)
]


def make_browser_ready(mp4_path: str | Path, *, remove_on_failure: bool = False) -> bool:
    """
    Re-encode *mp4_path* from mpeg4/mp4v → H.264 + faststart, in-place.

    Parameters
    ----------
    mp4_path        : path to the clip produced by concat_mp4()
    remove_on_failure: if True, delete the original file when ffmpeg fails
                       (useful if you want to skip broken clips entirely)

    Returns
    -------
    True  – re-encode succeeded; mp4_path now contains an H.264 stream.
    False – ffmpeg failed; mp4_path is left unchanged (or removed if flag set).
    """
    src = Path(mp4_path)
    if not src.exists():
        logger.warning("[h264] %s not found, skipping", src)
        return False

    tmp = src.with_suffix(".h264.tmp.mp4")

    cmd = ["ffmpeg", "-y", "-i", str(src)] + _FFMPEG_ENCODE_ARGS + [str(tmp)]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            check=True,
        )
        tmp.replace(src)      # atomic: old clip → new H.264 clip, same filename
        logger.info("[h264] ✓ re-encoded %s → H.264+faststart", src.name)
        return True

    except subprocess.CalledProcessError as exc:
        stderr_tail = (exc.stderr or b"").decode(errors="replace")[-400:]
        logger.error("[h264] ✗ ffmpeg failed for %s:\n%s", src.name, stderr_tail)
        tmp.unlink(missing_ok=True)

        if remove_on_failure:
            src.unlink(missing_ok=True)
            logger.warning("[h264] removed broken source %s", src.name)

        return False

    except FileNotFoundError:
        logger.error(
            "[h264] ffmpeg not found — install it with:  sudo apt install ffmpeg -y"
        )
        tmp.unlink(missing_ok=True)
        return False


def is_mpeg4(mp4_path: str | Path) -> bool:
    """Quick check: return True if the file uses the mpeg4/mp4v codec."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-hide_banner", "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name",
                "-of", "default=nw=1",
                str(mp4_path),
            ],
            capture_output=True, text=True, check=True,
        )
        return "mpeg4" in result.stdout.lower()
    except Exception:  # noqa: BLE001
        return False

