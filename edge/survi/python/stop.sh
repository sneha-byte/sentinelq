#!/bin/bash
cd ~/ArduinoApps/survillance/python

echo "[SYSTEM] Stopping pipeline..."

if [ -f logs/main.pid ]; then
  kill -9 "$(cat logs/main.pid)" 2>/dev/null || true
fi

if [ -f logs/uploader.pid ]; then
  kill -9 "$(cat logs/uploader.pid)" 2>/dev/null || true
fi

pkill -f "ffmpeg.*v4l2" 2>/dev/null || true
sudo fuser -k /dev/video4 2>/dev/null || true

echo "[SYSTEM] Done."
