import sys
import io
from pathlib import Path
import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app
from ai.tracking.byte_tracker import get_tracker_manager

client = TestClient(app)

def test_reset_tracking_endpoint():
    response = client.post("/api/v1/reset-tracking")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reset"

def test_bytetrack_manager_singleton():
    tracker1 = get_tracker_manager()
    tracker2 = get_tracker_manager()
    assert tracker1 is tracker2
