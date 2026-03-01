import os
import json
import time
import tempfile
import subprocess

def atomic_write_json(path: str, obj: dict):
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

def run_local_ei_binary(event_id: str, mp4_path: str, out_path: str,
                        frames: int = 5, threshold: float = 0.50,
                        runner_path: str = None) -> dict:
    """
    Calls compiled C++ EI runner which writes out_path.
    Returns parsed JSON dict.
    Always includes latency_ms in returned dict.
    """
    if runner_path is None:
        here = os.path.dirname(os.path.abspath(__file__))
        runner_path = os.path.abspath(os.path.join(here, "..", "cpp_infer", "build", "ei_infer_mp4"))

    if not os.path.exists(runner_path):
        raise RuntimeError(f"EI runner not found: {runner_path} (build cpp_infer first)")

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    cmd = [
        runner_path,
        "--event_id", str(event_id),
        "--mp4", str(mp4_path),
        "--out", str(out_path),
        "--frames", str(int(frames)),
        "--threshold", str(float(threshold)),
    ]

    t0 = time.time()
    p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    dt_ms = int((time.time() - t0) * 1000)

    if p.returncode != 0:
        err = (p.stderr or p.stdout or "").strip()
        fail = {
            "event_id": str(event_id),
            "model": "edgeimpulse_fomo_local",
            "status": "error",
            "error": err[:800],
            "latency_ms": dt_ms,
        }
        atomic_write_json(out_path, fail)
        return fail

    try:
        with open(out_path, "r") as f:
            obj = json.load(f)
        if isinstance(obj, dict) and "latency_ms" not in obj:
            obj["latency_ms"] = dt_ms
        return obj
    except Exception as e:
        fail = {
            "event_id": str(event_id),
            "model": "edgeimpulse_fomo_local",
            "status": "error",
            "error": f"runner produced unreadable json: {e}",
            "latency_ms": dt_ms,
        }
        atomic_write_json(out_path, fail)
        return fail
