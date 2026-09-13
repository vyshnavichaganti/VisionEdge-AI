import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from ai.distance.distance_estimator import DistanceEstimator

def test_distance_estimator_person():
    estimator = DistanceEstimator(reference_focal_length_px=650.0, reference_img_height_px=480.0)
    # Person box: y1=100, y2=300 -> height = 200px at 480p frame
    dist_m, dist_disp, dist_qual = estimator.estimate("person", (100, 100, 200, 300), img_height=480)
    
    # Formula: (1.70 * 650.0) / 200.0 = 5.525 -> round 5.53
    assert dist_m == 5.53
    assert "≈" in dist_disp
    assert "m" in dist_disp
    assert dist_qual == "approximate"

def test_distance_estimator_cell_phone():
    estimator = DistanceEstimator(reference_focal_length_px=650.0, reference_img_height_px=480.0)
    # Cell phone box: y1=100, y2=220 -> height = 120px at 480p frame
    dist_m, dist_disp, dist_qual = estimator.estimate("cell phone", (50, 100, 100, 220), img_height=480)
    
    # Formula: (0.15 * 650.0) / 120.0 = 0.8125 -> round 0.81
    assert dist_m == 0.81
    assert dist_disp == "≈ 0.8 m"
    assert dist_qual == "approximate"

def test_distance_estimator_clamping():
    estimator = DistanceEstimator()
    # Extremely small height -> clamp to 50.0m max
    dist_m, _, _ = estimator.estimate("person", (0, 0, 10, 1), img_height=480)
    assert dist_m <= 50.0

    # Extremely large height -> clamp to 0.1m min
    dist_m, _, _ = estimator.estimate("person", (0, 0, 10, 100000), img_height=480)
    assert dist_m >= 0.1
