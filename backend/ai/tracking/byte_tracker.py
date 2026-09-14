import logging
import torch
from ultralytics import YOLO
import numpy as np
from typing import List, Dict, Any, Optional
from app.config import settings
from ai.detection.yolo_detector import YOLODetector

logger = logging.getLogger("visionedge.tracking")

class ByteTrackerManager:
    _instance: Optional['ByteTrackerManager'] = None

    def __init__(self):
        self.detector = YOLODetector.get_instance()
        self.tracking_active = True

    @classmethod
    def get_instance(cls) -> 'ByteTrackerManager':
        if cls._instance is None:
            cls._instance = ByteTrackerManager()
        return cls._instance

    def track_objects(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs YOLOv8 + ByteTrack object tracking on image frame.
        Returns list of detected and tracked object dictionaries with track_id.
        Falls back safely to plain detection if tracking encounters an error.
        """
        if image is None or image.size == 0:
            return []

        try:
            with torch.inference_mode():
                # Use Ultralytics built-in ByteTrack implementation
                results = self.detector.model.track(
                    source=image,
                    conf=settings.CONFIDENCE_THRESHOLD,
                    tracker="bytetrack.yaml",
                    persist=True,
                    device="cpu",
                    verbose=False
                )

            tracked_objects = []
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes

                # Extract box coordinates, confidences, class IDs, and track IDs
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    cls_name = self.detector.model.names.get(cls_id, f"class_{cls_id}")

                    track_id = None
                    if box.id is not None:
                        try:
                            track_id = int(box.id[0].cpu().numpy())
                        except Exception:
                            track_id = None

                    tracked_objects.append({
                        "object_name": cls_name,
                        "confidence": round(conf, 4),
                        "bbox": [round(coord, 2) for coord in xyxy],
                        "track_id": track_id,
                        "cls_id": cls_id
                    })

            return tracked_objects
        except Exception as e:
            logger.error(f"ByteTrack tracking error: {e}. Falling back to plain detection.", exc_info=True)
            # Safe fallback: run standard detection without track_ids
            plain_detections = self.detector.detect(image)
            for d in plain_detections:
                d["track_id"] = None
            return plain_detections

    def reset_tracking(self) -> bool:
        """
        Resets ByteTrack session state so object IDs restart cleanly.
        Safely deletes predictor.trackers attribute so Ultralytics re-initializes ByteTrack.
        """
        try:
            predictor = getattr(self.detector.model, "predictor", None)
            if predictor is not None:
                if hasattr(predictor, "trackers"):
                    delattr(predictor, "trackers")
                if hasattr(predictor, "tracker"):
                    delattr(predictor, "tracker")
            return True
        except Exception as e:
            logger.error(f"Error resetting ByteTrack session: {e}")
            return False

# Global instance getter helper
def get_tracker_manager() -> ByteTrackerManager:
    return ByteTrackerManager.get_instance()
