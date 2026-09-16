# VisionEdge AI Backend - Lightweight CPU-Only Dockerfile
FROM python:3.11-slim

# Prevent python from writing pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TORCH_NUM_THREADS=2 \
    PORT=8000

# Install minimal OS dependencies for OpenCV Headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgl1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install CPU-only PyTorch and python packages
COPY requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

# Download YOLOv8n model during image build so runtime startup is instant
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Copy backend application source code
COPY app/ app/
COPY ai/ ai/

EXPOSE 8000

# Start Uvicorn backend listening on 0.0.0.0:$PORT
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
