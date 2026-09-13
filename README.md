# VisionEdge AI
> **Real-Time Intelligent Object Detection, Tracking and Distance Estimation System**

VisionEdge AI is a high-performance, real-time AI camera application designed for low memory overhead (< 512 MB RAM for Render Free Tier). It performs object detection, multi-object tracking (ByteTrack), and geometric approximate distance estimation in real time.

---

## 🏗️ Architecture

```
Browser Camera
      ↓
React + Vite Frontend (TypeScript)
      ↓
FastAPI Backend (Python 3.11)
      ↓
YOLOv8n Object Detection (CPU-Only PyTorch)
      ↓
ByteTrack Object Tracking
      ↓
Lightweight Approximate Distance Estimation
      ↓
JSON Response
      ↓
Frontend Canvas Overlay & Live Detections Table
```

---

## ⚡ Key Features

- **Phase 1 - Object Detection & Tracking:** Detects COCO object classes (`person`, `car`, `cell phone`, `laptop`, `chair`, `bottle`, etc.) using YOLOv8n and maintains persistent object identities using ByteTrack.
- **Phase 2 - Approximate Distance Estimation:** Calculates real-time distance in meters using pinhole camera geometry based on bounding box pixel height and reference class heights.
- **Memory Optimized:** Configured with CPU thread constraints (`TORCH_NUM_THREADS=2`) for low peak memory consumption (~333 MB peak RAM vs 512 MB target limit).
- **Single Page Application:** Minimalist, warm cream and muted gold UI designed for college demonstrations.

---

## 📏 Distance Estimation Formula

Distance is calculated using pinhole camera geometry:

$$\text{Distance (m)} = \frac{\text{Real Class Height (m)} \times \text{Effective Focal Length (px)}}{\text{Bounding Box Height (px)}}$$

- `distance_quality`: `"approximate"`
- UI format: `≈ 2.4 m`

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows: venv\Scripts\activate
# On Linux/Mac: source venv/bin/activate

pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Memory Benchmarking

Run the backend PyTest suite:
```bash
python -m pytest backend/tests
```

Run the automated RAM profiling benchmark:
```bash
python backend/tests/benchmark_memory.py
```

Test frontend build:
```bash
cd frontend
npm run build
```

---

## 🐳 Docker & Production Deployment

Build CPU-optimized Docker image:
```bash
docker build -t visionedge-ai-backend backend/
```

Run container:
```bash
docker run -p 8000:8000 visionedge-ai-backend
```

### Environment Variables
- `VITE_API_URL`: Backend API URL (defaults to `http://localhost:8000`)
- `PORT`: Port for backend Uvicorn server (defaults to `8000`)
- `TORCH_NUM_THREADS`: PyTorch CPU worker thread limit (defaults to `2`)
