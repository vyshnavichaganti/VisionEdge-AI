import sys
import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.main import app

client = TestClient(app)

def test_detect_empty_file():
    """Verify that uploading an empty file returns HTTP 400."""
    response = client.post(
        "/api/v1/detect",
        files={"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "empty" in data["detail"].lower()

def test_detect_corrupted_file():
    """Verify that uploading a corrupted image file returns HTTP 400."""
    response = client.post(
        "/api/v1/detect",
        files={"file": ("corrupt.txt", io.BytesIO(b"this is not an image file content"), "image/jpeg")}
    )
    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "invalid" in data["detail"].lower() or "corrupted" in data["detail"].lower()

def test_detect_missing_file():
    """Verify that omitting the file param returns HTTP 422 Unprocessable Entity."""
    response = client.post("/api/v1/detect")
    assert response.status_code == 422

def test_ready_endpoint_robustness():
    """Verify that GET /ready returns valid JSON structure."""
    response = client.get("/ready")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data
    assert "device" in data
