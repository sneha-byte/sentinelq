from ultralytics import YOLO
import requests
import base64
import time
import numpy as np
from PIL import Image, ImageEnhance
import io

# --- Config ----------------------------------------
API_URL = "https://your-app.vercel.app/api/hub/incidents"
DEVICE_TOKEN = "your-device-token"
CAMERA_NAME = "Front Door"

# Lower confidence threshold for low-light -- YOLO is less certain in the dark
CONFIDENCE_THRESHOLD = 0.35
COOLDOWN_SECONDS = 10

# --- Class maps ------------------------------------
PERSON_CLASSES = {0: "person"}
ANIMAL_CLASSES = {15: "cat", 16: "dog", 17: "horse", 18: "sheep",
                  19: "cow", 20: "elephant", 21: "bear", 22: "zebra"}
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 6: "train", 7: "truck"}

ALL_TRACKED = {**PERSON_CLASSES, **ANIMAL_CLASSES, **VEHICLE_CLASSES}

# --- Low-light performance ------------------------------------
def is_low_light(frame: np.ndarray) -> bool:
    """Returns Trueif the frame is significantly underexposed."""
    gray = np.mean(frame, axis = 2)
    return gray.mean() < 60 # below 60/255 brightness = low-light

def enhance_frame(frame: np.ndarray) -> np.ndarray:
    """
    Brightens and sharpens the frame before passing to YOLO.
    Only applied when low-light is detected to avoid washing out normal frames.

    Steps:
    1. Gamma protection - lifts shadows without blowing out highlights
    2. Contrast boost via PIL - improves local contrast
    3. Sharpness boost - edges become clearer, helps YOLO find outlines
    """
    # Step 1: Gamma correction (gamma < 1 = brighten shadows)
    gamma     = 0.6
    inv_gamma = 1.0 / gamma
    table     = np.array([((i / 255.0) ** inv_gamma) * 255 for i in range(256)]).astype(np.uint8)
    corrected = table[frame]  # apply lookup table to all pixels

    # Step 2 + 3: PIL for contrast and sharpness
    img = Image.fromarray(corrected[..., ::-1])  # BGR → RGB
    img = ImageEnhance.Contrast(img).enhance(1.5)   # boost local contrast
    img = ImageEnhance.Sharpness(img).enhance(2.0)  # sharpen edges
    return np.array(img)[..., ::-1]  # RGB → BGR for YOLO

# --- Scoring ------------------------------------
def compute_threat_score(detections: list[dict], is_dark: bool) -> int:
    score = 0
    for detection in detections:
        if detection["category"] == "person":
            score += 30
        elif detection["category"] == "vehicle":
            score += 15
        elif detection["category"] == "animal":
            score += 10

    # Low-light raises threat — harder to assess intent, higher risk
    if is_dark:
        score += 15

    return min(score, 100)

def decide_route(confidence: float, quality: int, is_dark: bool) -> str:
    # In low-light, push to cloud for verification —
    # local model confidence drops significantly in the dark
    if is_dark and confidence < 0.65:
        return "CLOUD"
    if confidence >= 0.75 and quality >= 60:
        return "LOCAL"
    elif confidence >= 0.50:
        return "LOCAL_VERIFY_CLOUD"
    return "CLOUD"

def build_summary(detections: list[dict], is_dark: bool) -> str:
    if not detections:
        return "No objects detected."
    parts = [f"{detection['label']} (conf: {detection['confidence']:.2f})" for detection in detections]
    conditions = " [LOW-LIGHT CONDITIONS]" if is_dark else ""
    return f"Detected: {', '.join(parts)} on {CAMERA_NAME}{conditions}"



# --- Snapshot from YOLO result ------------------------------------
def encode_snapshot(result) -> str:
    """
    Use the enhanced (pre-processed) frame for the snapshot,
    not the raw dark frame — so the saved image is actually viewable.
    """
    plotted = result.plot()
    img     = Image.fromarray(plotted[..., ::-1])
    buffer  = io.BytesIO()
    img.save(buffer, format="JPEG", quality=75)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")



# --- Quality from YOLO result ------------------------------------
def compute_quality_score(frame: np.ndarray) -> int:
    gray = np.mean(frame, axis=2).astype(np.uint8)

    diff = np.abs(gray[1:, :].astype(int) - gray[:-1, :].astype(int))
    blur_score = min(int(diff.mean() * 10), 50)

    brightness = gray.mean()

    # Penalize dark frames more aggressively in quality score
    if brightness < 30:
        brightness_score = 5    # very dark
    elif brightness < 60:
        brightness_score = 20   # dark
    elif brightness < 220:
        brightness_score = 50   # good
    else:
        brightness_score = 20   # overexposed

    return blur_score + brightness_score

# --- Post to API ------------------------------------
def post_incident(result, detections: list[dict]):
    quality = compute_quality_score(result)
    threat = compute_threat_score(detections)
    avg_conf = sum(detection["confidence"] for detection in detections) / len(detections)
    route = decide_route(avg_conf, quality)
    summary = build_summary(detections)
    snapshot = encode_snapshot(result)
    label = detections[0]["label"] if len(detections) == 1 else f"{len(detections)} objects detected"

    payload = {
        "camera_name":                    CAMERA_NAME,
        "label":                          label,
        "threat_score":                   threat,
        "quality_score":                  quality,
        "confidence":                     round(avg_conf, 3),
        "route_mode":                     route,
        "summary_local":                  summary,
        "snapshot_base64":                snapshot,
        "detections":                     detections,
    }

    try:
        res = requests.post(API_URL, json=payload, headers={"Authorization": f"Bearer {DEVICE_TOKEN}"}, timeout=5)
    except Exception as e:
        print(f"Post failed: {e}")

# --- Main loop ------------------------------------
def main():
    model = YOLO("yolov8n.pt")
    last_incident_time = 0

    print("SentinelQ CV running — press Ctrl+C to quit")

    # stream=True processes frame one at a time without buffering
    for result in model.track(source=0, stream=True, persist=True, verbose=False, show=True):
        detections = []

        if result.boxes is None:
            continue

        for box in result.boxes:
            cls_id = int(box.cls)
            conf = float(box.conf)

            if cls_id not in ALL_TRACKED or conf < CONFIDENCE_THRESHOLD:
                continue

            category = ("person" if cls_id in PERSON_CLASSES else "animal" if cls_id in ANIMAL_CLASSES else "vehicle")

            detections.append({
                "label": ALL_TRACKED[cls_id],
                "category": category,
                "confidence": round(conf, 3),
                "bbox":       [round(x) for x in box.xyxy[0].tolist()],
                "track_id":   int(box.id) if box.id is not None else None,
                "class_id":   cls_id,
            })

        now = time.time()
        if detections and (now - last_incident_time) > COOLDOWN_SECONDS:
            post_incident(result, detections)
            last_incident_time = now

if __name__ == "__main__":
    main()