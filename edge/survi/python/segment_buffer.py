import os
import time
import collections
import subprocess


class SegmentRingBuffer:
    """
    Rolling ring buffer of fixed-duration MP4 segments.

    Supports "pinning" segments so they won't be deleted while they're needed
    for an event clip build.
    """
    def __init__(self, dir_path: str, keep_seconds: int = 30):
        self.dir = dir_path
        os.makedirs(self.dir, exist_ok=True)
        self.keep_seconds = keep_seconds
        self.segs = collections.deque()  # (ts, path)
        self._pinned = set()             # paths that must not be deleted

    def pin_many(self, paths):
        for p in paths:
            if p:
                self._pinned.add(os.path.abspath(p))

    def unpin_many(self, paths):
        for p in paths:
            if p:
                self._pinned.discard(os.path.abspath(p))

    def add(self, ts: float, path: str):
        self.segs.append((ts, path))
        self.evict(time.time())

    def evict(self, now_ts: float):
        cutoff = now_ts - self.keep_seconds
        while self.segs and self.segs[0][0] < cutoff:
            _, p = self.segs[0]
            ap = os.path.abspath(p)

            # If pinned, don't delete; keep it in deque for now.
            # To prevent an infinite loop, rotate it to the end once.
            if ap in self._pinned:
                self.segs.rotate(-1)
                # If everything is pinned, stop trying.
                if all(os.path.abspath(x[1]) in self._pinned for x in self.segs):
                    break
                continue

            # Not pinned: delete and drop from deque
            self.segs.popleft()
            try:
                os.remove(p)
            except FileNotFoundError:
                pass
            except Exception:
                pass

    def snapshot_last(self, seconds: int):
        cutoff = time.time() - seconds
        return [p for (ts, p) in self.segs if ts >= cutoff]


def concat_mp4(out_path: str, mp4_paths: list[str]) -> bool:
    """
    Concatenate MP4 segments into one MP4.

    Strategy:
      1) Try stream-copy concat (-c copy) (fast)
      2) If that fails, retry with re-encode (robust)

    IMPORTANT:
      - Filters out missing files so one deleted segment doesn't kill the clip.
    """
    if not mp4_paths:
        return False

    # De-dupe while preserving order
    seen = set()
    mp4_paths = [p for p in mp4_paths if not (p in seen or seen.add(p))]

    # Filter out missing paths (avoid ffmpeg hard fail)
    existing = []
    missing = 0
    for p in mp4_paths:
        if p and os.path.exists(p):
            existing.append(p)
        else:
            missing += 1

    if len(existing) < 2:
        # Not enough to produce a meaningful clip
        if missing:
            print(f"[CLIP] not enough segments; missing={missing}, existing={len(existing)}")
        return False

    if missing:
        print(f"[CLIP] warning: {missing} segments missing; building clip with {len(existing)} segments")

    list_path = out_path + ".txt"
    with open(list_path, "w") as f:
        for p in existing:
            f.write(f"file '{os.path.abspath(p)}'\n")

    cmd_copy = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-fflags", "+genpts",
        "-c", "copy",
        out_path
    ]

    cmd_reencode = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", list_path,
        "-fflags", "+genpts",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "28",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path
    ]

    try:
        r = subprocess.run(cmd_copy, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if r.returncode == 0:
            return True

        print("[FFMPEG] concat copy failed, retrying re-encode...")
        print("[FFMPEG] copy stderr (last 20 lines):")
        print("\n".join(r.stderr.splitlines()[-20:]))

        r2 = subprocess.run(cmd_reencode, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if r2.returncode == 0:
            return True

        print("[FFMPEG] concat re-encode also failed.")
        print("[FFMPEG] re-encode stderr (last 40 lines):")
        print("\n".join(r2.stderr.splitlines()[-40:]))
        return False

    finally:
        try:
            os.remove(list_path)
        except FileNotFoundError:
            pass
        except Exception:
            pass
