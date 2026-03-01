# contracts.py
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional


RouteMode = Literal["LOCAL", "LOCAL_VERIFY_CLOUD", "CLOUD"]
IncidentStatus = Literal[
    "detected_local",
    "pending_cloud_verification",
    "verified",
    "rejected",
    "stored",
    "cloud_failed",
]
AnalysisMode = Literal["local", "cloud", "none"]
AnalysisStatus = Literal["ok", "error", "pending"]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def incident_status_from_route(route_mode: RouteMode) -> IncidentStatus:
    return "detected_local" if route_mode == "LOCAL" else "pending_cloud_verification"


@dataclass(frozen=True)
class IncidentScores:
    threat_score: int
    quality_score: Optional[int] = None
    confidence_score: Optional[float] = None
    compute_pressure_score: Optional[int] = None
    escalation_score: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "threat_score": int(self.threat_score),
            "quality_score": self.quality_score,
            "confidence_score": self.confidence_score,
            "compute_pressure_score": self.compute_pressure_score,
            "escalation_score": self.escalation_score,
        }


def make_incident_json(
    *,
    incident_id: str,
    hub_id: str,
    camera_id: str,
    started_at: str,
    ended_at: Optional[str],
    primary_label: str,
    route_mode: RouteMode,
    route_reason: Optional[str],
    scores: IncidentScores,
    analysis: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Canonical incident.json contract. Keep stable.
    """
    if analysis is None:
        analysis = {
            "mode": "none",
            "model": None,
            "status": "pending",
            "result_path": None,
            "summary": {"people": 0, "cars": 0},
            "latency_ms": 0,
        }

    return {
        "incident_id": incident_id,
        "hub_id": hub_id,
        "camera_id": camera_id,
        "primary_label": primary_label,
        "started_at": started_at,
        "ended_at": ended_at,
        "route_mode": route_mode,
        "route_reason": route_reason,
        "scores": scores.to_dict(),
        "analysis": analysis,
        "created_at": utcnow_iso(),
        "schema_version": 1,
    }


def make_result_json(
    *,
    status: AnalysisStatus,
    model_name: str,
    model_stage: Literal["local_fast", "local_verify", "cloud_verify"],
    labels: List[str],
    detections: List[Dict[str, Any]],
    summary: Dict[str, int],
    latency_ms: int,
) -> Dict[str, Any]:
    """
    Canonical result.json contract. Keep stable.
    """
    # Ensure required fields always present
    return {
        "status": status,
        "model_name": model_name,
        "model_stage": model_stage,
        "labels": labels,
        "detections": detections if detections is not None else [],
        "summary": summary if summary is not None else {"people": 0, "cars": 0},
        "latency_ms": int(latency_ms),
        "schema_version": 1,
        "created_at": utcnow_iso(),
    }
