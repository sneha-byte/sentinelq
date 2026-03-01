# api_client.py
from __future__ import annotations
import json
from typing import Any, Dict, Optional

import requests


class CloudClient:
    def __init__(self, base_url: str, device_token: str, timeout_sec: int = 30):
        self.base_url = base_url.rstrip("/")
        self.device_token = device_token
        self.timeout = timeout_sec

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.device_token}"}

    def ingest_incident(
        self,
        *,
        incident_json: Dict[str, Any],
        clip_path: str,
        result_json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/incidents/ingest"

        files = {
            "clip": ("clip.mp4", open(clip_path, "rb"), "video/mp4"),
        }
        data = {
            "incident_json": json.dumps(incident_json),
        }
        if result_json is not None:
            data["result_json"] = json.dumps(result_json)

        try:
            resp = requests.post(url, headers=self._headers(), data=data, files=files, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        finally:
            files["clip"][1].close()

    def upload_result(self, incident_id: str, result_json: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}/v1/incidents/{incident_id}/result"
        payload = {"result": result_json}
        resp = requests.post(url, headers=self._headers(), json=payload, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()
