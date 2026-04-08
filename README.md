# SentinelQ

**Devpost:** https://devpost.com/software/sentinelq

## Overview

SentinelQ is an edge-first security system designed to reduce false alarms and unnecessary cloud processing.

Instead of analyzing everything constantly, a low-power Arduino-based device monitors activity and only sends data to the cloud when something seems suspicious. The cloud system then runs object detection and evaluates how reliable the result is before deciding whether the situation needs attention.

The goal is simple: smarter alerts, lower cost, and more practical real-world monitoring.



## How It Works

### 1. Edge Monitoring (Arduino)
- Continuously monitors the environment using low-power sensing  
- Makes a first-pass decision on whether activity is suspicious  
- Only escalates events when needed  

This keeps the system efficient and avoids constant cloud usage.



### 2. Cloud Vision Processing
When an event is triggered:
- A camera frame is sent to the cloud  
- A YOLO-based detection pipeline processes the image  
- The system focuses only on:
  - People  
  - Animals  
  - Vehicles  

Irrelevant or low-confidence detections are ignored.



### 3. Reliability Checks
Before trusting a detection, the system evaluates:
- **Brightness** (to detect low-light conditions)  
- **Sharpness** (to detect blur)  
- **Detection confidence**  

These factors are combined to estimate how reliable the detection actually is.



### 4. Threat Scoring & Decision Making
- Each detection is assigned a **threat score**  
- The system decides whether to:
  - Handle locally  
  - Request further verification  
  - Escalate immediately  

This prevents overreacting to weak or uncertain detections.



### 5. Incident Reporting
Each event is logged as a structured report that includes:
- Risk score  
- Confidence level  
- Short summary  
- Image snapshot with bounding boxes  



### 6. Alert Control
To avoid spam:
- A cooldown period is enforced between alerts  
- Only meaningful events are reported  



## Why SentinelQ

Most security systems either:
- Run constant cloud analysis (expensive), or  
- Trigger too many false alarms  

SentinelQ balances both by:
- Filtering events at the edge  
- Verifying them in the cloud  
- Scoring how trustworthy each detection is  


## Tech Stack

- **Edge Device:** Arduino  
- **Camera Module:** ESP32-CAM (OV2640)  
- **Backend / Cloud:** Python-based detection pipeline  
- **Model:** YOLO (real-time object detection)  



## Key Features

- Edge-triggered cloud processing  
- Real-time object detection  
- Detection filtering by class and confidence  
- Image quality validation (brightness + sharpness)  
- Threat scoring system  
- Structured incident reports  
- Alert cooldown system  



## Future Improvements

- Live video streaming instead of single-frame analysis  
- Smarter tracking across multiple frames  
- Mobile notifications  
- Dashboard for viewing incidents in real time  
- Model fine-tuning for better accuracy  


