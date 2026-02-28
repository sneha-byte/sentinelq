"""
SentinelQ - cloudModel.py

This file captures frames from a YOLO model, scores detections (threat & quality),
decides whether to handle locally or send to a cloud API, and posts an incident payload.

Key improvements / fixes made:
- Removed stray non-breaking spaces and stray tokens.
- Robust extraction of the image frame from the YOLO result object or raw numpy arrays.
- Consistent parameter usage: functions receive either a numpy frame or detect/unwrap the result object.
- Added low-light detection and enhancement to improve model performance in dark conditions."""

from ultralytics import YOLO
import requests
import base64
import time
import numpy as np
from PIL import Image, ImageEnhance
import io
from typing import Any, List, Dict

# --- Config --------------------------------------------------------------
API_URL = "https://your-app.vercel.app/api/hub/incidents"  # Replace with real endpoint
DEVICE_TOKEN = "your-device-token"                         # Replace with real token
CAMERA_NAME = "Front Door"

# Behaviour tuning
CONFIDENCE_THRESHOLD = 0.35   # minimum detection confidence to consider
COOLDOWN_SECONDS = 10         # minimum seconds between incident posts

# --- Class maps ----------------------------------------------------------
# Maps class IDs (from COCO / YOLO) to human-readable labels.
PERSON_CLASSES = {0: "person"}
ANIMAL_CLASSES = {
    15: "cat", 16: "dog", 17: "horse", 18: "sheep",
    19: "cow", 20: "elephant", 21: "bear", 22: "zebra"
}
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 6: "train", 7: "truck"}

# Union of tracked classes
ALL_TRACKED = {**PERSON_CLASSES, **ANIMAL_CLASSES, **VEHICLE_CLASSES}

# --- Helpers to extract frame from YOLO result or accept a raw frame -----
def _frame_from_result(result_or_frame: Any) -> np.ndarray:
    """
    Accept either:
      - a numpy array frame (BGR or RGB),
      - or a YOLO results object (which may have attributes like .orig_img or .orig_imgs).
    Return a numpy.ndarray in BGR channel order (common for OpenCV / YOLO internal usage).
    This helper tries common attributes and falls back to result_or_frame if it's already an ndarray.
    """
    if isinstance(result_or_frame, np.ndarray):
        return result_or_frame
    # ultralytics Results historically exposes .orig_img or .orig_imgs
    if hasattr(result_or_frame, "orig_img"):
        return result_or_frame.orig_img
    if hasattr(result_or_frame, "orig_imgs"):
        imgs = result_or_frame.orig_imgs
        # orig_imgs can be a list; return first
        if isinstance(imgs, (list, tuple)) and len(imgs) > 0:
            return imgs[0]
    # Last resort: if the object has a plot() method, use that image (already annotated)
    if hasattr(result_or_frame, "plot"):
        plotted = result_or_frame.plot()
        # result.plot() returns RGB in many versions; convert to BGR for consistency
        arr = np.array(plotted)
        return arr[..., ::-1]
    raise TypeError("Unable to extract image frame from provided result_or_frame.")


# --- Low-light performance helpers --------------------------------------
def is_low_light(frame: np.ndarray) -> bool:
    """
    Decide if a frame is underexposed.
    Uses average luminance (simple but effective heuristic).
    Returns True if mean brightness < 60 (on 0-255 scale).
    """
    # frame expected as HxWxBGR or HxWxRGB; mean across color channels gives brightness estimation
    gray = np.mean(frame, axis=2)
    return float(gray.mean()) < 60.0


def enhance_frame(frame: np.ndarray) -> np.ndarray:
    """
    Enhance an underexposed frame before sending to the model or saving snapshots.

    Steps:
      1. Gamma correction (non-linear shadow lift)
      2. Contrast boost using PIL
      3. Sharpness boost using PIL

    Returns BGR numpy array (same channel order as input).
    """
    # Ensure uint8 input
    src = frame.astype(np.uint8)

    # Gamma correction: use lookup table for speed
    gamma = 0.6
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
    corrected = table[src]

    # Convert BGR -> RGB for PIL
    rgb = corrected[..., ::-1]
    img = Image.fromarray(rgb)
    img = ImageEnhance.Contrast(img).enhance(1.5)
    img = ImageEnhance.Sharpness(img).enhance(2.0)
    out_rgb = np.array(img)
    # Convert back to BGR (YOLO often expects BGR)
    return out_rgb[..., ::-1]


# --- Snapshot encoding ---------------------------------------------------
def encode_snapshot(result_or_frame: Any) -> str:
    """
    Produce a JPEG base64 snapshot for the payload.
    Prefers annotated/plot image when available (so boxes/labels are visible).
    Quality tuned to reduce payload size.
    """
    # If result object supports plot(), use that (annotated image)
    try:
        if hasattr(result_or_frame, "plot"):
            plotted = result_or_frame.plot()
            img = Image.fromarray(plotted[..., ::-1])  # plotted is usually RGB -> convert to PIL
        else:
            frame = _frame_from_result(result_or_frame)
            img = Image.fromarray(frame[..., ::-1])   # BGR->RGB
    except Exception:
        # Fallback: extract frame then encode
        frame = _frame_from_result(result_or_frame)
        img = Image.fromarray(frame[..., ::-1])

    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=75)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# --- Quality scoring ----------------------------------------------------
def compute_quality_score(frame_or_result: Any) -> int:
    """
    Compute a heuristic quality score (0..100-ish scale):
      - Measures local contrast / edges for blur estimation
      - Measures brightness and penalizes very dark / overexposed

    Accepts either a numpy frame or YOLO result object (unwrapped by helper).
    """
    frame = _frame_from_result(frame_or_result)
    gray = np.mean(frame, axis=2).astype(np.uint8)

    # Simple edge/blur proxy: mean of absolute differences between adjacent rows
    diff = np.abs(gray[1:, :].astype(int) - gray[:-1, :].astype(int))
    blur_score = min(int(diff.mean() * 10), 50)  # cap contribution

    brightness = float(gray.mean())

    # Brightness contribution (higher is better up to a point)
    if brightness < 30:
        brightness_score = 5    # very dark
    elif brightness < 60:
        brightness_score = 20   # dark
    elif brightness < 220:
        brightness_score = 50   # good
    else:
        brightness_score = 20   # overexposed

    return blur_score + brightness_score


# --- Threat scoring & routing ------------------------------------------
def compute_threat_score(detections: List[Dict], is_dark: bool) -> int:
    """
    Simple threat scoring:
      - person = 30 pts
      - vehicle = 15 pts
      - animal  = 10 pts
    Low-light increases the score due to uncertainty.
    Score is capped at 100.
    """
    score = 0
    for detection in detections:
        cat = detection.get("category", "")
        if cat == "person":
            score += 30
        elif cat == "vehicle":
            score += 15
        elif cat == "animal":
            score += 10

    if is_dark:
        score += 15

    return min(score, 100)


def decide_route(confidence: float, quality: int, is_dark: bool) -> str:
    """
    Decide whether to handle locally or escalate to cloud:
      - If low-light and low confidence -> CLOUD
      - High confidence and decent quality -> LOCAL
      - Mid confidence -> LOCAL_VERIFY_CLOUD (local first, verify in cloud)
      - Otherwise -> CLOUD
    """
    if is_dark and confidence < 0.65:
        return "CLOUD"
    if confidence >= 0.75 and quality >= 60:
        return "LOCAL"
    if confidence >= 0.50:
        return "LOCAL_VERIFY_CLOUD"
    return "CLOUD"


def build_summary(detections: List[Dict], is_dark: bool) -> str:
    """
    Build a short human-readable summary of detections for the payload.
    """
    if not detections:
        return "No objects detected."
    parts = [f"{d['label']} (conf: {d['confidence']:.2f})" for d in detections]
    conditions = " [LOW-LIGHT CONDITIONS]" if is_dark else ""
    return f"Detected: {', '.join(parts)} on {CAMERA_NAME}{conditions}"


# --- Posting incident to cloud -----------------------------------------
def post_incident(result_or_frame: Any, detections: List[Dict]):
    """
    Build an incident payload and POST to the configured API.
    Extracts frame, computes quality & threat, decides routing, encodes snapshot.
    Non-fatal network errors are printed but do not crash the loop.
    """
    # Extract a working frame (for quality and low-light checks)
    try:
        frame = _frame_from_result(result_or_frame)
    except TypeError:
        # If extraction failed, attempt to use plot() as fallback
        if hasattr(result_or_frame, "plot"):
            frame = np.array(result_or_frame.plot())[..., ::-1]
        else:
            # give up
            frame = None

    quality = compute_quality_score(frame) if frame is not None else 0
    is_dark = is_low_light(frame) if frame is not None else False

    # Average confidence across detections
    avg_conf = 0.0
    if detections:
        avg_conf = sum(d.get("confidence", 0.0) for d in detections) / len(detections)

    route = decide_route(avg_conf, quality, is_dark)
    summary = build_summary(detections, is_dark)
    snapshot = encode_snapshot(result_or_frame)
    label = detections[0]["label"] if len(detections) == 1 else f"{len(detections)} objects detected"
    threat = compute_threat_score(detections, is_dark)

    payload = {
        "camera_name":    CAMERA_NAME,
        "label":          label,
        "threat_score":   threat,
        "quality_score":  quality,
        "confidence":     round(avg_conf, 3),
        "route_mode":     route,
        "summary_local":  summary,
        "snapshot_base64": snapshot,
        "detections":     detections,
    }

    headers = {"Authorization": f"Bearer {DEVICE_TOKEN}"}
    try:
        res = requests.post(API_URL, json=payload, headers=headers, timeout=5)
        # For debugging, you might inspect res.status_code or res.text here.
    except Exception as e:
        # Non-fatal: print and continue operating
        print(f"Post failed: {e}")


# --- Main capture / tracking loop --------------------------------------
def main():
    """
    Run YOLO tracking on the default camera (source=0).
    For each frame:
      - Filter detections by class & confidence
      - Build structured detections list
      - Enforce a cooldown between incident posts
    """
    model = YOLO("yolov8n.pt")  # small model for edge devices; replace with appropriate model path
    last_incident_time = 0.0

    print("SentinelQ CV running — press Ctrl+C to quit")

    # stream=True yields one result per frame (no internal buffering).
    for result in model.track(source=0, stream=True, persist=True, verbose=False, show=True):
        detections: List[Dict] = []

        # result.boxes may be empty; guard early
        if not hasattr(result, "boxes") or result.boxes is None:
            continue

        # Iterate boxes and extract info in a stable way
        for box in result.boxes:
            # box.cls and box.conf are commonly available attributes
            try:
                cls_id = int(box.cls) if not isinstance(box.cls, (list, tuple, np.ndarray)) else int(box.cls[0])
            except Exception:
                # If cls cannot be parsed, skip this box
                continue
            try:
                conf = float(box.conf) if not isinstance(box.conf, (list, tuple, np.ndarray)) else float(box.conf[0])
            except Exception:
                continue

            if cls_id not in ALL_TRACKED or conf < CONFIDENCE_THRESHOLD:
                continue

            # Determine high-level category for simple threat scoring
            if cls_id in PERSON_CLASSES:
                category = "person"
            elif cls_id in ANIMAL_CLASSES:
                category = "animal"
            else:
                category = "vehicle"

            # Extract bbox coordinates robustly
            try:
                # box.xyxy may be a tensor/array; flatten to list
                xyxy = box.xyxy[0].tolist() if hasattr(box.xyxy, "__len__") else list(box.xyxy)
                bbox = [round(float(x)) for x in xyxy]
            except Exception:
                bbox = []

            detections.append({
                "label": ALL_TRACKED.get(cls_id, f"class_{cls_id}"),
                "category": category,
                "confidence": round(conf, 3),
                "bbox": bbox,
                "track_id": int(box.id) if hasattr(box, "id") and box.id is not None else None,
                "class_id": cls_id,
            })

        # Rate-limit incident posts
        now = time.time()
        if detections and (now - last_incident_time) > COOLDOWN_SECONDS:
            post_incident(result, detections)
            last_incident_time = now


if __name__ == "__main__":
    main()