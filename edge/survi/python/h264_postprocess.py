import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

_FFMPEG_ENCODE_ARGS = [
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-crf", "23",
    "-movflags", "+faststart",
    "-an",
]

def make_browser_ready(mp4_path, *, remove_on_failure: bool = False) -> bool:
    src = Path(mp4_path)
    if not src.exists():
        logger.warning("[h264] %s not found, skipping", src)
        return False

    tmp = src.with_suffix(".h264.tmp.mp4")
    cmd = ["ffmpeg", "-y", "-i", str(src)] + _FFMPEG_ENCODE_ARGS + [str(tmp)]

    try:
        subprocess.run(cmd, capture_output=True, check=True)
        tmp.replace(src)  # replace original in-place
        logger.info("[h264] ✓ re-encoded %s → H.264+faststart", src.name)
        return True

    except subprocess.CalledProcessError as exc:
        stderr_tail = (exc.stderr or b"").decode(errors="replace")[-400:]
        logger.error("[h264] ✗ ffmpeg failed for %s:\n%s", src.name, stderr_tail)
        try:
            tmp.unlink()
        except Exception:
            pass
        if remove_on_failure:
            try:
                src.unlink()
            except Exception:
                pass
        return False

    except FileNotFoundError:
        logger.error("[h264] ffmpeg not found — install: sudo apt install ffmpeg -y")
        try:
            tmp.unlink()
        except Exception:
            pass
        return False
