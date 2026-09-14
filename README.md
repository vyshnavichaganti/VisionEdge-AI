# VisionEdge AI

> **Lightweight Real-Time Object Detection, Tracking and Approximate Distance Estimation System**

VisionEdge AI is a lightweight real-time AI camera application designed for CPU-based object detection, multi-object tracking, and approximate distance estimation.

The system uses **YOLOv8n** for object detection, **ByteTrack** for persistent object identities, and a simplified **pinhole-camera model** for approximate distance estimation.

It includes a React + Vite frontend with live camera visualization, bounding-box overlays, tracking labels, and a live detections table.

> **Project Status:** Local development and testing completed. Deployment configuration prepared.

---

## ✨ Features

### Object Detection

- Real-time object detection using YOLOv8n.
- Supports supported COCO object classes.
- Example classes include:
  - Person
  - Car
  - Cell phone
  - Laptop
  - Chair
  - Bottle
- Displays object name and confidence score.

### Multi-Object Tracking

- Uses ByteTrack for object tracking.
- Maintains tracking IDs across consecutive frames when possible.
- Displays unique tracking IDs for detected objects.
- Handles objects entering and leaving the camera frame.
- Includes a Reset Tracking action.

### Bounding-Box Visualization

- Displays bounding boxes around detected objects.
- Shows object labels directly over the camera feed.
- Displays:
  - Object name
  - Confidence
  - Tracking ID
  - Approximate distance
- Uses a separate overlay canvas to prevent detection-box artifacts from affecting the input image.
- Uses temporal smoothing to reduce visual flickering.

### Approximate Distance Estimation

- Estimates object distance using a simplified pinhole-camera model.
- Displays distance in meters.
- Uses the format:

```text
≈ 2.4 m
```

- Handles invalid bounding-box dimensions safely.
- Supports fallback behavior for unknown object classes.
- Clearly identifies the distance as approximate.

### Lightweight CPU Processing

- Uses YOLOv8n instead of a larger model.
- Uses CPU-only PyTorch.
- Limits PyTorch CPU threads for lower resource usage.
- Designed with a low-memory deployment target in mind.
- Avoids heavy models such as MiDaS and FastSAM.

### Frontend Dashboard

- React + Vite frontend.
- TypeScript-based implementation.
- Live camera preview.
- Detection summary.
- Active target count.
- Live detections table.
- Bounding-box overlay.
- Confidence and distance labels.
- Reset Tracking control.
- Responsive cream, black, white, and muted-gold interface.

---

## 🏗️ System Architecture

```text
Browser Camera
      ↓
React + Vite Frontend
      ↓
Clean Offscreen Frame Capture
      ↓
FastAPI Backend
      ↓
YOLOv8n Object Detection
      ↓
ByteTrack Object Tracking
      ↓
Approximate Distance Estimation
      ↓
Temporal Stabilization
      ↓
JSON Response
      ↓
Frontend Canvas Overlay
      ↓
Live Detection Table
```

---

## 🛠️ Technology Stack

### Frontend

- React
- Vite
- TypeScript
- CSS
- HTML Canvas API
- Browser MediaDevices API

### Backend

- Python 3.11
- FastAPI
- Uvicorn
- Pydantic
- OpenCV
- NumPy

### AI and Computer Vision

- YOLOv8n
- Ultralytics
- ByteTrack
- CPU-only PyTorch
- Geometric distance estimation
- Temporal smoothing

### Testing and Deployment

- PyTest
- Docker
- Render-compatible backend configuration
- Vercel-compatible frontend configuration
- GitHub

---

## 📐 Distance Estimation

VisionEdge AI uses a simplified pinhole-camera model.

```text
Distance (m) =
    (Reference Object Height × Effective Focal Length in Pixels)
    / Bounding Box Height in Pixels
```

The distance estimate depends on:

- Camera position
- Camera angle
- Object orientation
- Object size
- Bounding-box quality
- Reference object dimensions
- Camera calibration
- Lighting conditions

The application displays distance as:

```text
≈ 3.3 m
```

### Important Limitation

The distance value is an **approximation**, not an exact measurement.

The system does not provide depth-sensor-level accuracy. For highly accurate distance measurement, camera calibration, stereo cameras, LiDAR, or dedicated depth sensors would be required.

---

## 🧠 Detection and Tracking Flow

For each camera frame:

1. The browser captures a clean frame from the video.
2. The frame is sent to the FastAPI backend.
3. YOLOv8n detects objects.
4. ByteTrack associates objects across frames.
5. Bounding boxes are used for approximate distance estimation.
6. The backend returns structured JSON data.
7. The frontend smooths short-term changes for display.
8. Bounding boxes and labels are drawn on the overlay canvas.
9. The live detections table is updated.

---

## 📦 Project Structure

```text
VisionEdge-AI/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── config.py
│   │
│   ├── ai/
│   │   ├── detection/
│   │   │   └── yolo_detector.py
│   │   │
│   │   ├── tracking/
│   │   │   └── byte_tracker.py
│   │   │
│   │   └── distance/
│   │       └── distance_estimator.py
│   │
│   ├── tests/
│   │   ├── test_tracking.py
│   │   ├── test_distance.py
│   │   └── test_api_error_handling.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── venv/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── LiveCamera.tsx
│   │   │
│   │   ├── services/
│   │   │   └── api.ts
│   │   │
│   │   ├── utils/
│   │   │   └── temporalTracker.ts
│   │   │
│   │   └── index.css
│   │
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   ├── .env.example
│   └── dist/
│
├── .gitignore
└── README.md
```

> The `venv/`, `node_modules/`, and `dist/` directories are local/generated directories and should not be committed to GitHub.

---

## 🚀 Local Setup

### Prerequisites

Install the following:

- Python 3.10 or Python 3.11
- Node.js and npm
- Git
- Optional: Docker

---

## 1. Clone the Repository

```bash
git clone https://github.com/vyshnavichaganti/VisionEdge-AI.git
cd VisionEdge-AI
```

---

## 2. Backend Setup

Open a terminal in the project root:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

### Activate the Virtual Environment

#### Windows PowerShell

```powershell
.\venv\Scripts\Activate.ps1
```

#### Windows Command Prompt

```cmd
venv\Scripts\activate.bat
```

#### Linux/macOS

```bash
source venv/bin/activate
```

Install the backend dependencies:

```bash
pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt
```

Start the FastAPI backend:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

### Backend API Documentation

Open:

```text
http://127.0.0.1:8000/docs
```

### Health Check

Open:

```text
http://127.0.0.1:8000/health
```

Expected response:

```json
{
  "status": "ok",
  "app": "VisionEdge AI",
  "version": "1.0.0"
}
```

---

## 3. Frontend Setup

Open a second terminal:

```bash
cd frontend
```

Install frontend dependencies:

```bash
npm install
```

Start the Vite development server:

```bash
npm run dev
```

Open the URL shown in the terminal. It is usually:

```text
http://localhost:5173
```

Keep the backend terminal running while using the frontend.

---

## 🔐 Environment Variables

### Backend

Create a local environment file if required:

```text
backend/.env
```

Use `backend/.env.example` as a reference.

Do not commit real secrets or private configuration files.

Common backend variables may include:

```env
PORT=8000
TORCH_NUM_THREADS=2
```

The backend uses the deployment-provided `PORT` value when available.

### Frontend

Create:

```text
frontend/.env
```

Example:

```env
VITE_API_URL=http://localhost:8000
```

For production, replace the value with the deployed backend URL:

```env
VITE_API_URL=https://your-backend-service.onrender.com
```

> Vite environment variables beginning with `VITE_` are included in the frontend build. Do not place secret API keys in frontend environment variables.

---

## 🧪 Testing

### Backend Syntax Check

Run from the `backend` directory:

```powershell
.\venv\Scripts\python.exe -m compileall app ai
```

### Backend Test Suite

Run from the `backend` directory:

```powershell
.\venv\Scripts\python.exe -m pytest -q
```

The project currently includes tests for:

- Tracking behavior
- Distance estimation
- Invalid bounding boxes
- Unknown object classes
- API error handling
- Empty or corrupted frames
- Health and readiness endpoints

### Frontend Production Build

Run from the `frontend` directory:

```bash
npm run build
```

### Git Validation

Run from the project root:

```bash
git diff --check
git status
```

---

## 🐳 Docker Setup

### Build the Backend Image

Run from the project root:

```bash
docker build -t visionedge-ai-backend backend/
```

### Run the Container

```bash
docker run -p 8000:8000 visionedge-ai-backend
```

Open the API documentation:

```text
http://localhost:8000/docs
```

### Docker Notes

- The backend uses a CPU-oriented Python image.
- YOLOv8n is used to reduce memory consumption.
- The application listens on the deployment-provided `PORT` value.
- Actual memory usage may vary depending on hardware, input resolution, and workload.

---

## ☁️ Deployment Architecture

The recommended deployment structure is:

```text
GitHub Repository
       │
       ├── Frontend → Vercel
       │
       └── Backend → Render
```

### Frontend Deployment

The frontend can be deployed using Vercel.

Recommended settings:

```text
Framework: Vite
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Set the frontend environment variable:

```env
VITE_API_URL=https://your-backend-service.onrender.com
```

### Backend Deployment

The backend can be deployed using a Docker-compatible hosting service such as Render.

The backend should:

- Use `backend/Dockerfile`.
- Listen on the provided `PORT`.
- Expose the `/health` endpoint.
- Configure CORS for the deployed frontend domain.
- Use CPU-only inference.
- Avoid committing model files or secrets unnecessarily.

> Free hosting services may have limited CPU, RAM, cold starts, and request timeouts. Actual performance may differ from local testing.

---

## 📊 Performance and Memory

The application is designed for lightweight CPU-based processing.

During local testing:

- YOLOv8n was used for detection.
- PyTorch CPU threads were limited.
- The observed local peak memory usage was approximately **320 MB** during testing.
- Actual memory usage can vary depending on:
  - Operating system
  - Python version
  - PyTorch version
  - Input resolution
  - Number of detected objects
  - Concurrent requests
  - Hosting environment

The project should not be considered guaranteed to remain below a specific memory limit in every deployment environment.

---

## ⚠️ Accuracy and Limitations

### Detection Accuracy

Detection performance depends on:

- Lighting
- Camera quality
- Object size
- Object visibility
- Camera angle
- Background complexity
- Model confidence threshold

### Tracking Accuracy

ByteTrack can maintain stable IDs when objects are clearly visible across consecutive frames. IDs may change when:

- Objects overlap
- Objects disappear for a long time
- The camera moves quickly
- Detection confidence drops
- Objects are heavily occluded

### Distance Accuracy

Distance estimation is approximate and depends on camera calibration and object dimensions.

### CPU Performance

CPU inference speed depends on:

- Processor speed
- Image resolution
- Number of objects
- Backend workload
- Hosting limitations

The system is intended for demonstration and experimental use, not safety-critical measurement.

---

## 🔒 Security Notes

- Do not commit `.env` files.
- Do not commit API keys or passwords.
- Do not commit private tokens.
- Do not commit `venv/`.
- Do not commit `node_modules/`.
- Do not commit generated build directories.
- Use `.env.example` files for configuration templates.
- Restrict CORS to the deployed frontend domain when moving to production.

---

## 📌 Current Project Status

| Component | Status |
|---|---|
| YOLOv8n detection | Completed |
| ByteTrack tracking | Completed |
| Bounding-box overlay | Completed |
| Tracking labels | Completed |
| Temporal smoothing | Completed |
| Approximate distance estimation | Completed |
| FastAPI endpoints | Completed |
| Error handling | Completed |
| Backend tests | Passed |
| Frontend production build | Passed |
| Docker configuration | Prepared |
| GitHub repository | Prepared |
| Production deployment | Pending |

---

## 🔮 Future Improvements

Possible future improvements include:

- Camera calibration for better distance estimation.
- Object-specific calibration profiles.
- FPS control.
- Confidence threshold control.
- Object class filtering.
- Detection history export.
- Advanced tracking analytics.
- GPU acceleration.
- Depth-camera integration.
- Mobile optimization.
- User authentication.
- Cloud-based analytics dashboard.

---

## 👩‍💻 Author

**Vyshnavi Chaganti**

GitHub:  
https://github.com/vyshnavichaganti

LinkedIn:  
https://www.linkedin.com/in/vyshnavi-chaganti-0bb374293/

---

## 📄 License

This project is intended for educational, demonstration, and experimental purposes.

Add an appropriate open-source license before distributing the project publicly.
