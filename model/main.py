from ultralytics import YOLO
import requests
import base64
import time
import numpy as np

# --- Config ----------------------------------------
API_URL = "https://your-app.vercel.app/api/hub/incidents"
DEVICE_TOKEN = "your-device-token"
CAMERA_NAME = "Front Door"
CONFIDENCE_THRESHOLD = 0.45
COOLDOWN_SECONDS = 10

# --- Class maps ------------------------------------
PERSON_CLASSES = {0: "person"}
ANIMAL_CLASSES = {15: "cat", 16: "dog", 17: "horse", 18: "sheep", 
                  19: "cow", 20: "elephant", 21: "bear", 22: "zebra"}
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 6: "train", 7: "truck"}

ALL_TRACKED = {**PERSON_CLASSES, **ANIMAL_CLASSES, **VEHICLE_CLASSES}

# --- Scoring ------------------------------------
def compute_threat_score(detections: list[dict]) -> int:
    score = 0
    for detection in detections:
        if detection["category"] == "person":
            score += 30
        elif detection["category"] == "vehicle":
            score += 15
        elif detection["category"] == "animal":
            score += 10  
    return min(score, 100)

def decide_route(confidence: float, quality: int) -> str:
    if confidence >= 0.75 and quality >= 60:
        return "LOCAL"
    elif confidence >= 0.50:
        return "LOCAL_VERIFY_CLOUD"
    else:
        return "CLOUD"

def build_summary(detections: list[dict]) -> str:
    if not detections:
        return "No objects detected."
    parts = [f"{detection['label']} (conf: {detection['confidence']:.2f})" for detection in detections]
    return f"Detected: {', '.join(parts)} on {CAMERA_NAME}"
  
# --- Snapshot from YOLO result ------------------------------------
def encode_snapshot(result) -> str:
    # YOLO gives us the plotted frame with boxes already them
    plotted = result.plot()
    from PIL import Image
    import io
    img = Image.fromarray(plotted[..., ::-1]) # BGR -> RGB
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=75)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")

# --- Quality from YOLO result ------------------------------------
def compute_quality_score(result) -> int:
    frame = result.orig_img                        # raw frame as numpy array
    gray = np.mean(frame, axis=2).astype(np.uint8) # rough grayscale
    
    # Blur estimate using variance of pixel differences
    diff = np.abs(gray[1:, :].astype(int))
    blur_score = min(int(diff.mean() * 10), 50)
    
    brightness = gray.mean()
    brightness_score = 50 if 40 < brightness < 220 else 20
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
        "camera_name":                    CAMERA_NAME,
        "label":                          label,
        "threat_score":                   threat,
        "quality_score":                  quality,
        "confidence":                     round(avg_conf, 3),
        "route_mode":                     route,
        "summary_local":                  summary,
        "snapshot_base64":                snapshot,
        "detections":                     detections,
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
                "bbox":       [round(x) for x in box.xyxy[0].tolist()],
                "track_id":   int(box.id) if box.id is not None else None,
                "class_id":   cls_id,
            })
        
        now = time.time()
        if detections and (now - last_incident_time) > COOLDOWN_SECONDS:
            post_incident(result, detections)
            last_incident_time = now

if __name__ == "__main__":
    main()