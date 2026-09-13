import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, VideoOff, RefreshCw, Zap, Circle } from 'lucide-react';
import { detectObjects, resetTracking, DetectionObject, SummaryData } from '../services/api';

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
  const animationFrameRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const [fps, setFps] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
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
      await resetTracking();
    } catch (e) {
      console.error('Reset tracking failed:', e);
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
    const scaleX = canvasWidth / videoWidth;
    const scaleY = canvasHeight / videoHeight;

    objects.forEach((obj) => {
      const [x1, y1, x2, y2] = obj.bbox;
      const rx1 = x1 * scaleX;
      const ry1 = y1 * scaleY;
      const rw = (x2 - x1) * scaleX;
      const rh = (y2 - y1) * scaleY;

      // Draw elegant bounding box
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#C5A059'; // Gold Accent
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(rx1, ry1, rw, rh, 6) : ctx.rect(rx1, ry1, rw, rh);
      ctx.stroke();

      // Label badge
      const trackTag = obj.track_id !== null ? `#${obj.track_id} ` : '';
      const confPercent = Math.round(obj.confidence * 100);
      const labelText = `${trackTag}${obj.object_name} (${confPercent}%) | ${obj.distance_display}`;

      ctx.font = '600 13px Inter, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const bgWidth = textMetrics.width + 16;
      const bgHeight = 24;

      const labelY = ry1 - bgHeight >= 0 ? ry1 - bgHeight : ry1;

      // Gold badge background
      ctx.fillStyle = '#C5A059';
      ctx.fillRect(rx1, labelY, bgWidth, bgHeight);

      // Dark text on gold badge for high contrast
      ctx.fillStyle = '#171717';
      ctx.fillText(labelText, rx1 + 8, labelY + 16);
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

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    if (!isProcessingRef.current) {
      isProcessingRef.current = true;
      canvas.toBlob(
        async (blob) => {
          if (blob && isStreaming) {
            try {
              const response = await detectObjects(blob);
              onDetectionsUpdate(response.objects, response.summary);

              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              drawDetections(
                ctx,
                response.objects,
                canvas.width,
                canvas.height,
                video.videoWidth,
                video.videoHeight
              );

              frameCountRef.current += 1;
              const now = performance.now();
              if (now - lastTimeRef.current >= 1000) {
                setFps(frameCountRef.current);
                frameCountRef.current = 0;
                lastTimeRef.current = now;
              }
            } catch (err) {
              console.error('Frame detection error:', err);
            }
          }
          isProcessingRef.current = false;
        },
        'image/jpeg',
        0.8
      );
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
        <video ref={videoRef} className="camera-video" style={{ display: 'none' }} playsInline muted />
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
