import os

class Settings:
    APP_NAME: str = "VisionEdge AI"
    VERSION: str = "1.0.0"
    
    # Network & Deployment settings
    PORT: int = int(os.getenv("PORT", 8000))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    
    # Environment CORS settings
    VITE_API_URL: str = os.getenv("VITE_API_URL", "http://localhost:8000")
    CORS_ORIGINS: list[str] = ["*"]
    
    # PyTorch CPU optimization settings
    TORCH_NUM_THREADS: int = int(os.getenv("TORCH_NUM_THREADS", 2))
    
    # AI Model settings
    MODEL_NAME: str = os.getenv("MODEL_NAME", "yolov8n.pt")
    CONFIDENCE_THRESHOLD: float = float(os.getenv("CONFIDENCE_THRESHOLD", 0.25))
    
    # Camera / Distance estimation reference focal length (in pixels)
    # Default calibrated value for standard webcam at 640x480 resolution
    DEFAULT_FOCAL_LENGTH_PX: float = 650.0

settings = Settings()
