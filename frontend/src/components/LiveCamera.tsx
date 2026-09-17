import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, VideoOff, RefreshCw, Circle, Cpu, AlertTriangle } from 'lucide-react';
import { detectObjects, resetTracking, DetectionObject, SummaryData } from '../services/api';
import { ONNXDetector } from '../services/onnxDetector';
import { TemporalTracker } from '../utils/temporalTracker';

interface LiveCameraProps {
  onDetectionsUpdate: (objects: DetectionObject[], summary: SummaryData) => void;
  isStreaming: boolean;
  setIsStreaming: (active: boolean) => void;
}

const MIN_DETECTION_INTERVAL_MS = 50; // ~20 FPS target processing rate for client-side ONNX Web
const TARGET_MAX_WIDTH = 480; // Downscaling limit for optional fallback API call

export const LiveCamera: React.FC<LiveCameraProps> = ({
  onDetectionsUpdate,
  isStreaming,
  setIsStreaming
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const latestDetectionsRef = useRef<DetectionObject[]>([]);
  const temporalTrackerRef = useRef<TemporalTracker>(new TemporalTracker());
  const sentDimensionsRef = useRef<{ width: number; height: number }>({ width: 640, height: 480 });

  const [renderFps, setRenderFps] = useState<number>(0);
  const [aiFps, setAiFps] = useState<number>(0);
  const [modelLoading, setModelLoading] = useState<boolean>(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const aiFrameCountRef = useRef<number>(0);
  const lastDetectionTimeRef = useRef<number>(0);

  // Pre-load ONNX model on component mount
  useEffect(() => {
    let isMounted = true;
    const initONNX = async () => {
      const detector = ONNXDetector.getInstance();
      if (!detector.isModelLoaded() && !detector.isModelLoading()) {
        if (isMounted) setModelLoading(true);
        try {
          await detector.initModel('/models/yolov8n.onnx');
          if (isMounted) {
            setModelLoading(false);
            setModelError(null);
          }
        } catch (err: any) {
          console.warn('[LiveCamera] ONNX Model failed to load, fallback to server API:', err);
          if (isMounted) {
            setModelLoading(false);
            setModelError('Local ONNX model load failed. Cloud API fallback enabled.');
          }
        }
      }
    };
    initONNX();
    return () => { isMounted = false; };
  }, []);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      latestDetectionsRef.current = [];
      temporalTrackerRef.current.reset();

      // Ensure model is initializing
      const detector = ONNXDetector.getInstance();
      if (!detector.isModelLoaded() && !detector.isModelLoading()) {
        setModelLoading(true);
        detector.initModel('/models/yolov8n.onnx')
          .then(() => {
            setModelLoading(false);
            setModelError(null);
          })
          .catch((err) => {
            setModelLoading(false);
            setModelError('Local ONNX load failed. Falling back to server API.');
          });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setErrorMsg('Camera access denied or unavailable. Please check webcam permissions.');
      setIsStreaming(false);
    }
  };

  const stopCamera = () => {
    setIsStreaming(false);
    latestDetectionsRef.current = [];
    temporalTrackerRef.current.reset();
    setRenderFps(0);
    setAiFps(0);
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    onDetectionsUpdate([], {
      total_objects: 0,
      people_count: 0,
      scene_status: 'Clear',
      tracking_status: 'Standby'
    });
  };

  const handleResetTracking = async () => {
    try {
      setErrorMsg(null);
      await resetTracking().catch(() => {}); // Optional call to backend reset
      latestDetectionsRef.current = [];
      temporalTrackerRef.current.reset();
      onDetectionsUpdate([], {
        total_objects: 0,
        people_count: 0,
        scene_status: 'Clear',
        tracking_status: 'Active (ONNX + ByteTrack)'
      });
    } catch (e: any) {
      console.error('Reset tracking failed:', e);
      setErrorMsg('Reset tracking request failed.');
    }
  };

  const drawDetections = (
    ctx: CanvasRenderingContext2D,
    objects: DetectionObject[],
    canvasWidth: number,
    canvasHeight: number,
    frameWidth: number,
    frameHeight: number
  ) => {
    if (!objects || objects.length === 0) return;

    const scaleX = frameWidth > 0 ? canvasWidth / frameWidth : 1.0;
    const scaleY = frameHeight > 0 ? canvasHeight / frameHeight : 1.0;

    objects.forEach((obj) => {
      if (!obj.bbox || obj.bbox.length < 4) return;
      const [x1, y1, x2, y2] = obj.bbox;

      const rx1 = Math.max(0, x1 * scaleX);
      const ry1 = Math.max(0, y1 * scaleY);
      const rw = Math.min(canvasWidth - rx1, (x2 - x1) * scaleX);
      const rh = Math.min(canvasHeight - ry1, (y2 - y1) * scaleY);

      if (rw <= 2 || rh <= 2) return;

      // Draw bounding box
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#C5A059'; // Gold Accent
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(rx1, ry1, rw, rh, 6);
      } else {
        ctx.rect(rx1, ry1, rw, rh);
      }
      ctx.stroke();

      // Label badge text: e.g. "Person | 85% | ID #1 | ≈ 3.3 m"
      const capitalizedName = obj.object_name.charAt(0).toUpperCase() + obj.object_name.slice(1);
      const confPercent = Math.round(obj.confidence * 100);
      const trackTag = obj.track_id !== null ? ` | ID #${obj.track_id}` : '';
      const labelText = `${capitalizedName} | ${confPercent}%${trackTag} | ${obj.distance_display}`;

      ctx.font = '600 13px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const bgWidth = textMetrics.width + 16;
      const bgHeight = 24;

      const labelX = Math.max(0, Math.min(rx1, canvasWidth - bgWidth));
      const labelY = ry1 - bgHeight >= 0 ? ry1 - bgHeight : ry1;

      // Gold badge background
      ctx.fillStyle = '#C5A059';
      ctx.fillRect(labelX, labelY, bgWidth, bgHeight);

      // Dark text on gold badge
      ctx.fillStyle = '#171717';
      ctx.fillText(labelText, labelX + 8, labelY + 16);
    });
  };

  const captureAndDetect = useCallback(async () => {
    if (!isStreaming || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState !== 4) {
      animationFrameRef.current = requestAnimationFrame(captureAndDetect);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    // Clear overlay canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render detections
    drawDetections(
      ctx,
      latestDetectionsRef.current,
      canvas.width,
      canvas.height,
      sentDimensionsRef.current.width,
      sentDimensionsRef.current.height
    );

    // Update FPS counters
    frameCountRef.current += 1;
    const now = performance.now();
    if (now - lastTimeRef.current >= 1000) {
      setRenderFps(frameCountRef.current);
      setAiFps(aiFrameCountRef.current);
      frameCountRef.current = 0;
      aiFrameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    // Capture & Detect loop with lock and throttle
    if (!isProcessingRef.current && (now - lastDetectionTimeRef.current >= MIN_DETECTION_INTERVAL_MS)) {
      isProcessingRef.current = true;
      lastDetectionTimeRef.current = now;

      try {
        let rawDetections: DetectionObject[] = [];
        const detector = ONNXDetector.getInstance();

        if (detector.isModelLoaded()) {
          // Primary Path: Fast local browser-side ONNX WebGL/WASM detection
          rawDetections = await detector.detect(video, 0.35, 0.45);
          aiFrameCountRef.current += 1;
          sentDimensionsRef.current = { width: video.videoWidth || 640, height: video.videoHeight || 480 };
        } else {
          // Fallback Path: Remote server API
          if (!offscreenCanvasRef.current) {
            offscreenCanvasRef.current = document.createElement('canvas');
          }
          const offCanvas = offscreenCanvasRef.current;
          const videoW = video.videoWidth || 640;
          const videoH = video.videoHeight || 480;
          const aspect = videoH / videoW;
          const sendW = Math.min(videoW, TARGET_MAX_WIDTH);
          const sendH = Math.round(sendW * aspect);

          sentDimensionsRef.current = { width: sendW, height: sendH };

          if (offCanvas.width !== sendW || offCanvas.height !== sendH) {
            offCanvas.width = sendW;
            offCanvas.height = sendH;
          }
          const offCtx = offCanvas.getContext('2d');
          if (offCtx) {
            offCtx.drawImage(video, 0, 0, sendW, sendH);
            const blob = await new Promise<Blob | null>((resolve) => offCanvas.toBlob(resolve, 'image/jpeg', 0.70));
            if (blob && isStreaming) {
              const response = await detectObjects(blob);
              rawDetections = response.objects;
              aiFrameCountRef.current += 1;
            }
          }
        }

        // Pass raw detections through temporal tracker for box smoothing & track ID assignment
        const stabilized = temporalTrackerRef.current.update(rawDetections);
        latestDetectionsRef.current = stabilized;

        const peopleCount = stabilized.filter(o => o.object_name.toLowerCase() === 'person').length;
        const totalObjs = stabilized.length;
        const sceneStatus = totalObjs === 0 ? 'Clear' : totalObjs <= 4 ? 'Active' : 'Crowded';

        const updatedSummary: SummaryData = {
          total_objects: totalObjs,
          people_count: peopleCount,
          scene_status: sceneStatus,
          tracking_status: detector.isModelLoaded() ? 'Active (ONNX WebGL)' : 'Active (Server Fallback)'
        };

        onDetectionsUpdate(stabilized, updatedSummary);
        setErrorMsg(null);
      } catch (err: any) {
        console.error('Frame detection loop error:', err);
      } finally {
        isProcessingRef.current = false;
      }
    }

    if (isStreaming) {
      animationFrameRef.current = requestAnimationFrame(captureAndDetect);
    }
  }, [isStreaming, onDetectionsUpdate]);

  useEffect(() => {
    if (isStreaming) {
      animationFrameRef.current = requestAnimationFrame(captureAndDetect);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, captureAndDetect]);

  return (
    <div className="card camera-card">
      <div className="card-title">
        <span>Live Camera View</span>
        {isStreaming ? (
          <span className="status-pill status-live">
            <Circle className="w-2.5 h-2.5 fill-current inline" /> LIVE ({renderFps} FPS | AI: {aiFps} FPS)
          </span>
        ) : (
          <span className="status-pill status-neutral">
            <Circle className="w-2.5 h-2.5 fill-current inline" /> OFFLINE
          </span>
        )}
      </div>

      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="camera-canvas" />

        {modelLoading && (
          <div className="camera-placeholder" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10 }}>
            <Cpu className="w-10 h-10 animate-pulse" style={{ color: 'var(--accent-gold)' }} />
            <p style={{ fontWeight: 600, color: '#FFFFFF', marginTop: '8px' }}>Initializing ONNX WebGL Model...</p>
            <p style={{ fontSize: '12px', color: '#A3A3A3' }}>Downloading pre-trained COCO YOLO model (~12MB)</p>
          </div>
        )}

        {!isStreaming && !modelLoading && (
          <div className="camera-placeholder">
            <Camera className="w-12 h-12" style={{ color: 'var(--accent-gold)' }} />
            <p style={{ fontWeight: 500, color: '#A3A3A3' }}>Camera Feed Standby</p>
          </div>
        )}
      </div>

      {modelError && (
        <div className="status-pill status-amber" style={{ justifyContent: 'center', marginTop: '8px' }}>
          <AlertTriangle className="w-4 h-4 inline mr-1" /> {modelError}
        </div>
      )}

      {errorMsg && (
        <div className="status-pill status-red" style={{ justifyContent: 'center', marginTop: '8px' }}>
          {errorMsg}
        </div>
      )}

      <div className="camera-controls">
        {!isStreaming ? (
          <button className="btn btn-primary" onClick={startCamera} disabled={modelLoading}>
            <Camera className="w-4 h-4" /> Start Camera
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopCamera}>
            <VideoOff className="w-4 h-4" /> Stop Camera
          </button>
        )}

        <button className="btn btn-secondary" onClick={handleResetTracking}>
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--accent-dark-gold)' }} /> Reset Tracking
        </button>
      </div>
    </div>
  );
};
