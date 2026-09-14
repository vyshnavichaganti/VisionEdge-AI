import logging
import torch
from ultralytics import YOLO
import numpy as np
from typing import List, Dict, Any, Optional
from app.config import settings

logger = logging.getLogger("visionedge.detection")

class YOLODetector:
    _instance: Optional['YOLODetector'] = None

    def __init__(self, model_name: str = settings.MODEL_NAME):
        # Configure conservative PyTorch thread settings for low RAM & CPU usage
        num_threads = settings.TORCH_NUM_THREADS
        torch.set_num_threads(num_threads)
        if hasattr(torch, "set_num_interop_threads"):
            try:
                torch.set_num_interop_threads(num_threads)
            except Exception:
                pass

        # Load YOLO model CPU only
        self.model = YOLO(model_name)
        self.model.to("cpu")
        self.conf_threshold = settings.CONFIDENCE_THRESHOLD

    @classmethod
    def get_instance(cls) -> 'YOLODetector':
        if cls._instance is None:
            cls._instance = YOLODetector()
        return cls._instance

    def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs object detection on an image frame (BGR format).
        Returns list of detection dictionaries.
        """
        if image is None or image.size == 0:
            return []

        try:
            with torch.inference_mode():
                results = self.model.predict(
                    source=image,
                    conf=self.conf_threshold,
                    device="cpu",
                    verbose=False
                )

            detections = []
            if len(results) > 0 and results[0].boxes is not None:
                boxes = results[0].boxes
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    conf = float(box.conf[0].cpu().numpy())
                    cls_id = int(box.cls[0].cpu().numpy())
                    cls_name = self.model.names.get(cls_id, f"class_{cls_id}")

                    detections.append({
                        "object_name": cls_name,
                        "confidence": round(conf, 4),
                        "bbox": [round(coord, 2) for coord in xyxy],
                        "cls_id": cls_id
                    })

            return detections
        except Exception as e:
            logger.error(f"YOLO predict error: {e}", exc_info=True)
            return []
