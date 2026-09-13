import sys
import io
from pathlib import Path
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

client = TestClient(app)

def create_synthetic_frame() -> bytes:
    # Create 640x480 blank synthetic frame with geometric shapes
    img = np.ones((480, 640, 3), dtype=np.uint8) * 240
    # Draw rectangle simulating object
    cv2.rectangle(img, (100, 100), (300, 400), (50, 50, 200), -1)
    is_success, buffer = cv2.imencode(".jpg", img)
    return buffer.tobytes()

def test_detect_endpoint():
    frame_bytes = create_synthetic_frame()
    response = client.post(
        "/api/v1/detect",
        files={"file": ("test_frame.jpg", io.BytesIO(frame_bytes), "image/jpeg")}
    )
    assert response.status_code == 200
    data = response.json()
    
    assert "objects" in data
    assert "inference_time_ms" in data
    assert "summary" in data
    assert isinstance(data["inference_time_ms"], float)
    assert data["inference_time_ms"] > 0
    assert "total_objects" in data["summary"]
    assert "people_count" in data["summary"]
    assert "scene_status" in data["summary"]
