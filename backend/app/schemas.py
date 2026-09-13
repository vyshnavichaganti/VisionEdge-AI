from pydantic import BaseModel, Field
from typing import List, Optional

class DetectionObject(BaseModel):
    object_name: str = Field(..., description="COCO class name e.g. person, cell phone")
    confidence: float = Field(..., description="Detection confidence 0.0 - 1.0")
    bbox: List[float] = Field(..., description="Bounding box [x1, y1, x2, y2] in pixels")
    track_id: Optional[int] = Field(None, description="ByteTrack object identifier")
    distance_m: float = Field(..., description="Approximate distance in meters")
    distance_display: str = Field(..., description="Formated distance string e.g. ≈ 2.4 m")
    distance_quality: str = Field("approximate", description="Accuracy level identifier")

class SummaryData(BaseModel):
    total_objects: int = Field(0, description="Total detected objects count")
    people_count: int = Field(0, description="Number of detected people")
    scene_status: str = Field("Clear", description="Scene description e.g. Clear, Active, Crowded")
    tracking_status: str = Field("Active", description="ByteTrack state e.g. Active, Standby")

class DetectionResponse(BaseModel):
    objects: List[DetectionObject]
    inference_time_ms: float
    summary: SummaryData

class HealthResponse(BaseModel):
    status: str = "ok"
    app: str = "VisionEdge AI"
    version: str = "1.0.0"

class ReadyResponse(BaseModel):
    status: str = "ready"
    model_loaded: bool = True
    device: str = "cpu"
