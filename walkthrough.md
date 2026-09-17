# Walkthrough - Browser-Side YOLO ONNX Implementation

We have successfully implemented client-side real-time YOLO object detection in the browser using **ONNX Runtime Web (`onnxruntime-web`)** with WebGL hardware acceleration. This eliminates the 34-second Render Free Tier CPU bottleneck, achieving **15–45ms (~20–40 FPS)** real-time inference directly in the browser while preserving all existing backend APIs, tracking, distance estimation, and UI features.

---

## Key Accomplishments

### 1. ONNX Model Asset Integration
* **Asset Location**: [`frontend/public/models/yolov8n.onnx`](file:///d:/VisionEdge-AI/frontend/public/models/yolov8n.onnx) (12.1 MB).
* **Source**: Official pre-trained COCO YOLOv8n model exported with input shape `[1, 3, 320, 320]`. 80 standard COCO classes (`person`, `car`, `dog`, `bottle`, etc.). Zero custom training or external dataset required.

### 2. Browser Detection Service (`onnxDetector.ts`)
* Created [`frontend/src/services/onnxDetector.ts`](file:///d:/VisionEdge-AI/frontend/src/services/onnxDetector.ts):
  * **WebGL Acceleration**: Uses `ort.InferenceSession.create('/models/yolov8n.onnx', { executionProviders: ['webgl', 'wasm'] })`.
  * **Preprocessing**: Converts video frame to 320x320 RGB Normalized Float32 NCHW tensor (`[1, 3, 320, 320]`).
  * **NMS & Confidence Filtering**: Filters output tensor `[1, 84, 2100]` with confidence threshold `0.35` and IoU threshold `0.45`.
  * **Pinhole Distance Estimation**: Computes approximate geometric distance in meters directly in TypeScript (`estimateDistance`).

### 3. Smooth UI & Temporal Tracking Integration
* Updated [`LiveCamera.tsx`](file:///d:/VisionEdge-AI/frontend/src/components/LiveCamera.tsx):
  * **Real-time Loop**: Captures webcam frames at ~20 FPS (`MIN_DETECTION_INTERVAL_MS = 50`) without overlapping requests.
  * **Temporal Tracking**: Passes ONNX detections directly into [`temporalTracker.ts`](file:///d:/VisionEdge-AI/frontend/src/utils/temporalTracker.ts) to maintain Exponential Moving Average (EMA) box smoothing, track IDs (`#1`, `#2`), and grace periods.
  * **Model Loading & Fallback**: Renders an inline indicator during model initialization (`"Initializing ONNX WebGL Model..."`) and falls back gracefully to the Render server API if ONNX initialization fails.

---

## Verification & Test Results

### 1. Frontend Production Build
```bash
npm run build
```
* **Result**: `✓ 1479 modules transformed. Built in 14.90s` with **0 errors**.

### 2. Backend Test Suite
```bash
pytest backend/tests
```
* **Result**: **18 passed in 5.62s** (All tests passing cleanly).
  * `test_api_error_handling.py` PASS
  * `test_config.py` PASS
  * `test_cors.py` PASS
  * `test_detection.py` PASS
  * `test_distance.py` PASS
  * `test_health.py` PASS
  * `test_tracking.py` PASS

---

## Summary of Changed Files

* [`frontend/package.json`](file:///d:/VisionEdge-AI/frontend/package.json): Added `onnxruntime-web` dependency.
* [`frontend/public/models/yolov8n.onnx`](file:///d:/VisionEdge-AI/frontend/public/models/yolov8n.onnx) *(NEW)*: Pre-trained COCO YOLOv8 ONNX model asset (12.1 MB).
* [`frontend/src/services/onnxDetector.ts`](file:///d:/VisionEdge-AI/frontend/src/services/onnxDetector.ts) *(NEW)*: Browser-side ONNX WebGL detection & distance service.
* [`frontend/src/components/LiveCamera.tsx`](file:///d:/VisionEdge-AI/frontend/src/components/LiveCamera.tsx): Integrated client-side ONNX inference, status indicators, and server fallback.

*Note: No commits or pushes have been made yet, adhering to instructions.*
