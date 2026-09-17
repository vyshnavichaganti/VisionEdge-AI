import time
import logging
import asyncio
import cv2
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.schemas import (
    DetectionResponse,
    DetectionObject,
    SummaryData,
    HealthResponse,
    ReadyResponse,
)
from ai.detection.yolo_detector import YOLODetector
from ai.tracking.byte_tracker import get_tracker_manager
from ai.distance.distance_estimator import distance_estimator

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("visionedge.api")

# Async lock to synchronize CPU model inference across concurrent HTTP requests
model_lock = asyncio.Lock()

# Pre-load AI models during FastAPI startup lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize YOLO single-instance loader on startup
    try:
        logger.info("Initializing VisionEdge AI models...")
        YOLODetector.get_instance()
        get_tracker_manager()
        logger.info("VisionEdge AI models successfully initialized.")
    except Exception as e:
        logger.error(f"Error initializing models during startup: {e}", exc_info=True)
    yield
    # Cleanup if needed

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="Real-Time Intelligent Object Detection, Tracking and Distance Estimation System",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint for deployment monitoring."""
    return HealthResponse(status="ok", app=settings.APP_NAME, version=settings.VERSION)

@app.get("/ready", response_model=ReadyResponse, tags=["Health"])
async def readiness_check():
    """Readiness endpoint verifying AI model loading status."""
    try:
        detector = YOLODetector.get_instance()
        is_loaded = detector.model is not None
        return ReadyResponse(status="ready" if is_loaded else "loading", model_loaded=is_loaded, device="cpu")
    except Exception as e:
        logger.error(f"Model readiness check error: {e}", exc_info=True)
        return ReadyResponse(status="error", model_loaded=False, device="cpu")

@app.post("/api/v1/detect", response_model=DetectionResponse, tags=["Detection"])
async def detect_objects(file: UploadFile = File(...)):
    """
    Main detection, ByteTrack tracking, and approximate distance estimation pipeline.
    Accepts an uploaded image frame.
    """
    start_time = time.perf_counter()

    try:
        # Read image contents
        contents = await file.read()
        if not contents or len(contents) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid image file format or corrupted frame.")

        img_height, img_width = frame.shape[:2]

        # Run object tracking (YOLOv8 + ByteTrack) with async model lock for thread safety
        async with model_lock:
            tracker = get_tracker_manager()
            tracked_items = tracker.track_objects(frame)

        objects_output = []
        people_count = 0

        for item in tracked_items:
            cls_name = item.get("object_name", "unknown")
            bbox = item.get("bbox", [0, 0, 0, 0])
            conf = item.get("confidence", 0.0)
            track_id = item.get("track_id", None)

            if cls_name.lower() == "person":
                people_count += 1

            # Calculate approximate distance
            dist_m, dist_disp, dist_qual = distance_estimator.estimate(
                class_name=cls_name,
                bbox=tuple(bbox),
                img_height=img_height
            )

            objects_output.append(
                DetectionObject(
                    object_name=cls_name,
                    confidence=conf,
                    bbox=bbox,
                    track_id=track_id,
                    distance_m=dist_m,
                    distance_display=dist_disp,
                    distance_quality=dist_qual
                )
            )

        end_time = time.perf_counter()
        inference_ms = round((end_time - start_time) * 1000, 2)
        logger.info(f"Detection completed in {inference_ms}ms (objects: {len(objects_output)})")

        total_objs = len(objects_output)
        if total_objs == 0:
            scene_status = "Clear"
        elif total_objs <= 4:
            scene_status = "Active"
        else:
            scene_status = "Crowded"

        summary = SummaryData(
            total_objects=total_objs,
            people_count=people_count,
            scene_status=scene_status,
            tracking_status="Active (ByteTrack)"
        )

        return DetectionResponse(
            objects=objects_output,
            inference_time_ms=inference_ms,
            summary=summary
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during detection pipeline processing: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Detection failed. Please try again."
        )

@app.post("/api/v1/reset-tracking", tags=["Tracking"])
async def reset_tracking():
    """Resets ByteTrack session state so track IDs restart from scratch."""
    try:
        async with model_lock:
            tracker = get_tracker_manager()
            success = tracker.reset_tracking()
        return {"status": "reset" if success else "failed", "message": "Tracker session reset"}
    except Exception as e:
        logger.error(f"Error resetting tracking: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to reset tracker session.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=False)
