import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings

def test_config_defaults():
    assert isinstance(settings.PORT, int)
    assert settings.HOST == "0.0.0.0"
    assert settings.TORCH_NUM_THREADS == 2
    assert settings.MODEL_NAME == "yolov8n.pt"
    assert settings.DEFAULT_FOCAL_LENGTH_PX == 650.0
