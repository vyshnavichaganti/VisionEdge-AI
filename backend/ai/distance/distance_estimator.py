from typing import Tuple, Dict

# Standard average real-world heights (in meters) for common COCO object classes
REFERENCE_HEIGHTS_M: Dict[str, float] = {
    "person": 1.70,
    "car": 1.50,
    "bus": 3.20,
    "truck": 3.00,
    "motorcycle": 1.10,
    "bicycle": 1.00,
    "cell phone": 0.15,
    "laptop": 0.25,
    "chair": 0.90,
    "couch": 0.85,
    "dining table": 0.75,
    "tv": 0.50,
    "bottle": 0.25,
    "cup": 0.12,
    "book": 0.22,
    "dog": 0.55,
    "cat": 0.30,
    "potted plant": 0.60,
    "bird": 0.20,
    "backpack": 0.45,
    "umbrella": 0.80,
    "handbag": 0.30,
    "tie": 0.40,
    "suitcase": 0.60,
    "clock": 0.25,
    "vase": 0.30,
}

DEFAULT_REFERENCE_HEIGHT_M = 0.50

class DistanceEstimator:
    def __init__(self, reference_focal_length_px: float = 650.0, reference_img_height_px: float = 480.0):
        self.reference_focal_length_px = reference_focal_length_px
        self.reference_img_height_px = reference_img_height_px

    def estimate(
        self,
        class_name: str,
        bbox: Tuple[float, float, float, float],
        img_height: int = 480
    ) -> Tuple[float, str, str]:
        """
        Estimates approximate distance in meters using pinhole camera geometry.

        NOTE: This is an APPROXIMATE geometric distance estimation based on object bounding-box
        height relative to reference focal length and physical object dimensions. It is not an
        exact real-world depth measurement.

        Formula:
            Scaled Focal Length = Reference Focal Length * (img_height / reference_img_height)
            Distance (m) = (Real Height (m) * Scaled Focal Length) / Bounding Box Height (px)

        Returns:
            (distance_m, distance_display, distance_quality)
        """
        if not bbox or len(bbox) < 4:
            return 0.0, "N/A", "unavailable"

        x1, y1, x2, y2 = bbox
        box_height_px = float(y2 - y1)
        box_width_px = float(x2 - x1)

        # Defensive check for zero or negative bounding box size
        if box_height_px <= 1.0 or box_width_px <= 1.0:
            return 0.0, "N/A", "unavailable"

        # Scale focal length dynamically based on frame image height
        safe_img_height = max(float(img_height), 1.0)
        scale_factor = safe_img_height / self.reference_img_height_px
        effective_focal_length = self.reference_focal_length_px * scale_factor

        # Obtain real-world reference height estimate for the object class
        class_key = class_name.strip().lower() if isinstance(class_name, str) else "unknown"
        real_height_m = REFERENCE_HEIGHTS_M.get(class_key, DEFAULT_REFERENCE_HEIGHT_M)

        # Calculate geometric distance (m)
        raw_distance = (real_height_m * effective_focal_length) / box_height_px
        distance_m = round(float(raw_distance), 1)

        # Clamp distance to realistic physical range [0.1m, 50.0m]
        distance_m = max(0.1, min(distance_m, 50.0))
        distance_display = f"≈ {distance_m:.1f} m"
        distance_quality = "approximate"

        return distance_m, distance_display, distance_quality

# Global singleton instance
distance_estimator = DistanceEstimator()
