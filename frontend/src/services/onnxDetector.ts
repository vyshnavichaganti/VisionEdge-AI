import * as ort from 'onnxruntime-web';
import { DetectionObject } from './api';

// 80 Standard COCO Dataset Class Names
export const COCO_CLASSES: string[] = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket', 'bottle',
  'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
  'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
  'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
];

// Average real-world heights (in meters) for distance estimation (matches backend distance_estimator.py)
const REFERENCE_HEIGHTS_M: Record<string, number> = {
  person: 1.70, car: 1.50, bus: 3.20, truck: 3.00, motorcycle: 1.10, bicycle: 1.00,
  'cell phone': 0.15, laptop: 0.25, chair: 0.90, couch: 0.85, 'dining table': 0.75,
  tv: 0.50, bottle: 0.25, cup: 0.12, book: 0.22, dog: 0.55, cat: 0.30,
  'potted plant': 0.60, bird: 0.20, backpack: 0.45, umbrella: 0.80, handbag: 0.30,
  tie: 0.40, suitcase: 0.60, clock: 0.25, vase: 0.30, remote: 0.18, keyboard: 0.15,
  mouse: 0.08, apple: 0.08, banana: 0.15, scissors: 0.18, 'sports ball': 0.22,
  'wine glass': 0.20, spoon: 0.15, fork: 0.15, knife: 0.15, bowl: 0.12
};

const DEFAULT_REF_HEIGHT_M = 0.50;
const REF_FOCAL_LENGTH_PX = 650.0;
const REF_IMG_HEIGHT_PX = 480.0;
const MODEL_IMG_SIZE = 320;

export function estimateDistance(
  className: string,
  bbox: [number, number, number, number],
  imgHeight: number
): { distance_m: number; distance_display: string; distance_quality: string } {
  const [x1, y1, x2, y2] = bbox;
  const boxHeightPx = Math.max(1.0, y2 - y1);
  const scaleFactor = Math.max(imgHeight, 1.0) / REF_IMG_HEIGHT_PX;
  const effectiveFocalLength = REF_FOCAL_LENGTH_PX * scaleFactor;
  const classKey = className.trim().toLowerCase();
  const realHeightM = REFERENCE_HEIGHTS_M[classKey] || DEFAULT_REF_HEIGHT_M;
  const rawDist = (realHeightM * effectiveFocalLength) / boxHeightPx;

  let distM = Math.round(rawDist * 10) / 10;
  distM = Math.max(0.1, Math.min(distM, 50.0));

  return {
    distance_m: distM,
    distance_display: `≈ ${distM.toFixed(1)} m`,
    distance_quality: 'approximate'
  };
}

export class ONNXDetector {
  private static instance: ONNXDetector | null = null;
  private session: ort.InferenceSession | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private isLoading = false;
  private loadError: string | null = null;

  private constructor() {
    // Configure ONNX Runtime WASM threads defensively for cross-origin environments
    ort.env.wasm.numThreads = 1;
  }

  public static getInstance(): ONNXDetector {
    if (!ONNXDetector.instance) {
      ONNXDetector.instance = new ONNXDetector();
    }
    return ONNXDetector.instance;
  }

  public isModelLoaded(): boolean {
    return this.session !== null;
  }

  public getLoadError(): string | null {
    return this.loadError;
  }

  public isModelLoading(): boolean {
    return this.isLoading;
  }

  /**
   * Initializes the ONNX model session (loads static asset from /models/yolov8n.onnx once).
   */
  public async initModel(modelUrl: string = '/models/yolov8n.onnx'): Promise<void> {
    if (this.session) return;
    if (this.isLoading) return;

    this.isLoading = true;
    this.loadError = null;

    try {
      console.log(`[ONNXDetector] Initializing ONNX Web session from ${modelUrl}...`);
      
      // Try WebGL first for GPU hardware acceleration, fallback to WASM
      this.session = await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['webgl', 'wasm'],
        graphOptimizationLevel: 'all'
      });

      console.log('[ONNXDetector] ONNX session successfully created!');
      console.log('[ONNXDetector] Inputs:', this.session.inputNames);
      console.log('[ONNXDetector] Outputs:', this.session.outputNames);
    } catch (err: any) {
      console.error('[ONNXDetector] Failed to initialize ONNX model:', err);
      this.loadError = err.message || 'Failed to load ONNX model.';
      this.session = null;
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Detects objects in a video or image HTML element using client-side ONNX Web.
   */
  public async detect(
    sourceElement: HTMLVideoElement | HTMLCanvasElement,
    confThreshold: number = 0.35,
    iouThreshold: number = 0.45
  ): Promise<DetectionObject[]> {
    if (!this.session) {
      throw new Error('ONNX model is not loaded. Call initModel() first.');
    }

    const srcWidth = sourceElement instanceof HTMLVideoElement ? sourceElement.videoWidth : sourceElement.width;
    const srcHeight = sourceElement instanceof HTMLVideoElement ? sourceElement.videoHeight : sourceElement.height;

    if (!srcWidth || !srcHeight) return [];

    // Prepare 320x320 offscreen canvas
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCanvas.width = MODEL_IMG_SIZE;
      this.offscreenCanvas.height = MODEL_IMG_SIZE;
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    const ctx = this.offscreenCtx;
    if (!ctx) return [];

    // Draw frame scaled to 320x320
    ctx.drawImage(sourceElement, 0, 0, MODEL_IMG_SIZE, MODEL_IMG_SIZE);
    const imageData = ctx.getImageData(0, 0, MODEL_IMG_SIZE, MODEL_IMG_SIZE);
    const { data } = imageData; // 320 * 320 * 4 RGBA bytes

    // Convert RGBA Uint8 -> Normalised Float32 Planar RGB (1 * 3 * 320 * 320)
    const float32Data = new Float32Array(1 * 3 * MODEL_IMG_SIZE * MODEL_IMG_SIZE);
    const channelSize = MODEL_IMG_SIZE * MODEL_IMG_SIZE;

    for (let i = 0; i < channelSize; i++) {
      float32Data[i] = data[i * 4] / 255.0;                   // R
      float32Data[channelSize + i] = data[i * 4 + 1] / 255.0; // G
      float32Data[2 * channelSize + i] = data[i * 4 + 2] / 255.0; // B
    }

    const inputName = this.session.inputNames[0];
    const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, MODEL_IMG_SIZE, MODEL_IMG_SIZE]);

    // Run ONNX Model Inference
    const outputMap = await this.session.run({ [inputName]: inputTensor });
    const outputName = this.session.outputNames[0];
    const outputTensor = outputMap[outputName];
    const outputData = outputTensor.data as Float32Array;

    // Parse YOLOv8 Output Tensor: [1, 84, 2100]
    // 84 rows x 2100 columns
    const candidates: Array<{
      cls_id: number;
      cls_name: string;
      score: number;
      bbox: [number, number, number, number]; // [x1, y1, x2, y2] in src dimensions
    }> = [];

    const numAnchors = 2100;
    const numRows = 84;

    const scaleX = srcWidth / MODEL_IMG_SIZE;
    const scaleY = srcHeight / MODEL_IMG_SIZE;

    for (let col = 0; col < numAnchors; col++) {
      // Find highest class confidence score among rows 4..83
      let maxScore = 0;
      let maxClsId = -1;

      for (let row = 4; row < numRows; row++) {
        const score = outputData[row * numAnchors + col];
        if (score > maxScore) {
          maxScore = score;
          maxClsId = row - 4;
        }
      }

      if (maxScore >= confThreshold && maxClsId >= 0) {
        const cx = outputData[0 * numAnchors + col];
        const cy = outputData[1 * numAnchors + col];
        const w = outputData[2 * numAnchors + col];
        const h = outputData[3 * numAnchors + col];

        const x1 = Math.max(0, (cx - w / 2) * scaleX);
        const y1 = Math.max(0, (cy - h / 2) * scaleY);
        const x2 = Math.min(srcWidth, (cx + w / 2) * scaleX);
        const y2 = Math.min(srcHeight, (cy + h / 2) * scaleY);

        const clsName = COCO_CLASSES[maxClsId] || `class_${maxClsId}`;

        candidates.push({
          cls_id: maxClsId,
          cls_name: clsName,
          score: Math.round(maxScore * 10000) / 10000,
          bbox: [Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)]
        });
      }
    }

    // Apply Non-Maximum Suppression (NMS)
    const nmsDetections = this.nonMaxSuppression(candidates, iouThreshold);

    // Compute distance estimations
    const results: DetectionObject[] = nmsDetections.map((det) => {
      const distInfo = estimateDistance(det.cls_name, det.bbox, srcHeight);
      return {
        object_name: det.cls_name,
        confidence: det.score,
        bbox: det.bbox,
        track_id: null, // Track IDs will be assigned/managed by temporalTracker
        distance_m: distInfo.distance_m,
        distance_display: distInfo.distance_display,
        distance_quality: distInfo.distance_quality
      };
    });

    return results;
  }

  /**
   * Performs Non-Maximum Suppression to remove duplicate overlapping bounding boxes.
   */
  private nonMaxSuppression(
    boxes: Array<{ cls_id: number; cls_name: string; score: number; bbox: [number, number, number, number] }>,
    iouThreshold: number
  ) {
    // Sort boxes by confidence score descending
    boxes.sort((a, b) => b.score - a.score);

    const selected: typeof boxes = [];
    const active = new Array(boxes.length).fill(true);

    for (let i = 0; i < boxes.length; i++) {
      if (!active[i]) continue;
      const boxA = boxes[i];
      selected.push(boxA);

      for (let j = i + 1; j < boxes.length; j++) {
        if (!active[j]) continue;
        const boxB = boxes[j];

        // Only suppress boxes of the same object class
        if (boxA.cls_id === boxB.cls_id) {
          const iou = calculateIoU(boxA.bbox, boxB.bbox);
          if (iou >= iouThreshold) {
            active[j] = false;
          }
        }
      }
    }

    return selected;
  }
}

function calculateIoU(boxA: [number, number, number, number], boxB: [number, number, number, number]): number {
  const [ax1, ay1, ax2, ay2] = boxA;
  const [bx1, by1, bx2, by2] = boxB;

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersectionArea = iw * ih;

  const areaA = Math.max(0, ax2 - ax1) * Math.max(0, ay2 - ay1);
  const areaB = Math.max(0, bx2 - bx1) * Math.max(0, by2 - by1);

  const unionArea = areaA + areaB - intersectionArea;
  if (unionArea <= 0) return 0;

  return intersectionArea / unionArea;
}
