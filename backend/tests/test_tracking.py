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

def test_tracking_sequence_and_reset_recovery():
    """Verify that calling track_objects -> reset_tracking -> track_objects does NOT throw IndexError."""
    tracker = get_tracker_manager()
    frame = np.ones((480, 640, 3), dtype=np.uint8) * 200

    # First track call
    res1 = tracker.track_objects(frame)
    assert isinstance(res1, list)

    # Reset tracking session
    reset_ok = tracker.reset_tracking()
    assert reset_ok is True

    # Second track call must succeed without IndexError
    res2 = tracker.track_objects(frame)
    assert isinstance(res2, list)

def test_tracking_empty_frame():
    """Verify tracking handles empty/blank frames with zero detections cleanly."""
    tracker = get_tracker_manager()
    blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    res = tracker.track_objects(blank_frame)
    assert isinstance(res, list)
