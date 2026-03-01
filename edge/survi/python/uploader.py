# uploader.py
import json
from pathlib import Path

from uploader_worker import upload_loop

def main():
    cfg = json.loads(Path("config.json").read_text(encoding="utf-8"))
    events_root = Path(cfg["paths"]["events_root"])
    upload_loop(
        events_root=events_root,
        cloud_url=cfg["cloud_url"],
        device_token=cfg["device_token"],
        scan_interval_sec=cfg["uploader"]["scan_interval_sec"],
        timeout_sec=cfg["uploader"]["request_timeout_sec"],
        max_retries=cfg["uploader"]["max_retries"],
        retry_backoff_sec=cfg["uploader"]["retry_backoff_sec"],
    )

if __name__ == "__main__":
    main()
