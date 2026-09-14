import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, VideoOff, RefreshCw, Circle } from 'lucide-react';
import { detectObjects, resetTracking, DetectionObject, SummaryData } from '../services/api';
import { TemporalTracker } from '../utils/temporalTracker';

interface LiveCameraProps {
  onDetectionsUpdate: (objects: DetectionObject[], summary: SummaryData) => void;
  isStreaming: boolean;
  setIsStreaming: (active: boolean) => void;
}

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

  const [fps, setFps] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      latestDetectionsRef.current = [];
      temporalTrackerRef.current.reset();
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
      await resetTracking();
      latestDetectionsRef.current = [];
      temporalTrackerRef.current.reset();
      onDetectionsUpdate([], {
        total_objects: 0,
        people_count: 0,
        scene_status: 'Clear',
        tracking_status: 'Active (ByteTrack)'
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
    videoWidth: number,
    videoHeight: number
  ) => {
    if (!objects || objects.length === 0) return;

    const scaleX = videoWidth > 0 ? canvasWidth / videoWidth : 1.0;
    const scaleY = videoHeight > 0 ? canvasHeight / videoHeight : 1.0;

    objects.forEach((obj) => {
      if (!obj.bbox || obj.bbox.length < 4) return;
      const [x1, y1, x2, y2] = obj.bbox;

      const rx1 = Math.max(0, x1 * scaleX);
      const ry1 = Math.max(0, y1 * scaleY);
      const rw = Math.min(canvasWidth - rx1, (x2 - x1) * scaleX);
      const rh = Math.min(canvasHeight - ry1, (y2 - y1) * scaleY);

      if (rw <= 2 || rh <= 2) return;

      // Draw elegant bounding box
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

      // Prevent label background from going off canvas edges
      const labelX = Math.max(0, Math.min(rx1, canvasWidth - bgWidth));
      const labelY = ry1 - bgHeight >= 0 ? ry1 - bgHeight : ry1;

      // Gold badge background
      ctx.fillStyle = '#C5A059';
      ctx.fillRect(labelX, labelY, bgWidth, bgHeight);

      // High-contrast dark text on gold badge
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

    // 1. Clear transparent overlay canvas before rendering bounding boxes
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Render latest temporally-smoothed detections on overlay canvas
    drawDetections(
      ctx,
      latestDetectionsRef.current,
      canvas.width,
      canvas.height,
      video.videoWidth,
      video.videoHeight
    );

    // Update FPS counter
    frameCountRef.current += 1;
    const now = performance.now();
    if (now - lastTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    // 3. Capture raw video frame via offscreen canvas to avoid sending bounding box artifacts
    if (!isProcessingRef.current) {
      isProcessingRef.current = true;

      if (!offscreenCanvasRef.current) {
        offscreenCanvasRef.current = document.createElement('canvas');
      }
      const offCanvas = offscreenCanvasRef.current;
      if (offCanvas.width !== video.videoWidth || offCanvas.height !== video.videoHeight) {
        offCanvas.width = video.videoWidth || 640;
        offCanvas.height = video.videoHeight || 480;
      }
      const offCtx = offCanvas.getContext('2d');
      if (offCtx) {
        offCtx.drawImage(video, 0, 0, offCanvas.width, offCanvas.height);
        offCanvas.toBlob(
          async (blob) => {
            if (blob && isStreaming) {
              try {
                const response = await detectObjects(blob);

                // Pass raw detections through temporal tracker for smoothing & grace period
                const stabilized = temporalTrackerRef.current.update(response.objects);
                latestDetectionsRef.current = stabilized;

                // Development debug logging
                if (import.meta.env.DEV && response.objects.length > 0) {
                  console.log('[VisionEdge AI Dev Log]', {
                    sourceWidth: video.videoWidth,
                    sourceHeight: video.videoHeight,
                    canvasWidth: canvas.width,
                    canvasHeight: canvas.height,
                    rawDetectionsCount: response.objects.length,
                    stabilizedCount: stabilized.length,
                    firstBbox: response.objects[0].bbox,
                    firstTrackId: response.objects[0].track_id,
                  });
                }

                // Compute updated summary based on stabilized objects
                const peopleCount = stabilized.filter(o => o.object_name.toLowerCase() === 'person').length;
                const totalObjs = stabilized.length;
                const sceneStatus = totalObjs === 0 ? 'Clear' : totalObjs <= 4 ? 'Active' : 'Crowded';

                const updatedSummary: SummaryData = {
                  total_objects: totalObjs,
                  people_count: peopleCount,
                  scene_status: sceneStatus,
                  tracking_status: 'Active (ByteTrack)'
                };

                onDetectionsUpdate(stabilized, updatedSummary);
                setErrorMsg(null);
              } catch (err: any) {
                console.error('Frame detection error:', err);
                if (err.message && err.message.includes('offline')) {
                  setErrorMsg('AI Backend Offline. Retrying...');
                }
              }
            }
            isProcessingRef.current = false;
          },
          'image/jpeg',
          0.85
        );
      } else {
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
            <Circle className="w-2.5 h-2.5 fill-current inline" /> LIVE ({fps} FPS)
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

        {!isStreaming && (
          <div className="camera-placeholder">
            <Camera className="w-12 h-12" style={{ color: 'var(--accent-gold)' }} />
            <p style={{ fontWeight: 500, color: '#A3A3A3' }}>Camera Feed Standby</p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="status-pill status-red" style={{ justifyContent: 'center' }}>
          {errorMsg}
        </div>
      )}

      <div className="camera-controls">
        {!isStreaming ? (
          <button className="btn btn-primary" onClick={startCamera}>
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
