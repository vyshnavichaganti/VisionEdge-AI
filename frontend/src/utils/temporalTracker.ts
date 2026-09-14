import { DetectionObject } from '../services/api';

export interface TrackedEntry extends DetectionObject {
  firstSeen: number;
  lastSeen: number;
  missedFrames: number;
  smoothedConf: number;
  smoothedDistM: number;
  smoothedBbox: [number, number, number, number];
}

export class TemporalTracker {
  private trackedMap: Map<string, TrackedEntry> = new Map();
  private maxMissedFrames: number = 5; // ~500ms grace period at ~10 FPS
  private alpha: number = 0.35; // Exponential moving average weight

  /**
   * Processes raw backend detections through exponential moving average smoothing
   * and a grace period for missed detections.
   */
  public update(rawDetections: DetectionObject[]): DetectionObject[] {
    const now = performance.now();
    const currentFrameMatchedKeys = new Set<string>();

    // 1. Match raw detections to existing tracked entries
    rawDetections.forEach((det) => {
      let key: string;
      if (det.track_id !== null && det.track_id !== undefined) {
        key = `id_${det.track_id}`;
      } else {
        key = this.findSpatialMatchKey(det);
      }

      currentFrameMatchedKeys.add(key);
      const existing = this.trackedMap.get(key);

      if (existing) {
        // Apply EMA smoothing to confidence
        const smoothedConf = this.alpha * det.confidence + (1 - this.alpha) * existing.smoothedConf;

        // Apply EMA smoothing to distance
        const smoothedDistM = this.alpha * det.distance_m + (1 - this.alpha) * existing.smoothedDistM;
        const roundedDistM = Math.round(smoothedDistM * 10) / 10;
        const distDisplay = `≈ ${roundedDistM.toFixed(1)} m`;

        // Apply EMA smoothing to bounding box coordinates
        const smoothedBbox: [number, number, number, number] = [
          Math.round(this.alpha * det.bbox[0] + (1 - this.alpha) * existing.smoothedBbox[0]),
          Math.round(this.alpha * det.bbox[1] + (1 - this.alpha) * existing.smoothedBbox[1]),
          Math.round(this.alpha * det.bbox[2] + (1 - this.alpha) * existing.smoothedBbox[2]),
          Math.round(this.alpha * det.bbox[3] + (1 - this.alpha) * existing.smoothedBbox[3]),
        ];

        this.trackedMap.set(key, {
          object_name: det.object_name,
          confidence: roundDec(smoothedConf, 4),
          bbox: smoothedBbox,
          track_id: det.track_id ?? existing.track_id,
          distance_m: roundedDistM,
          distance_display: distDisplay,
          distance_quality: det.distance_quality,
          firstSeen: existing.firstSeen,
          lastSeen: now,
          missedFrames: 0,
          smoothedConf,
          smoothedDistM,
          smoothedBbox,
        });
      } else {
        // New object entry
        const roundedDistM = Math.round(det.distance_m * 10) / 10;
        this.trackedMap.set(key, {
          object_name: det.object_name,
          confidence: det.confidence,
          bbox: [...det.bbox] as [number, number, number, number],
          track_id: det.track_id,
          distance_m: roundedDistM,
          distance_display: `≈ ${roundedDistM.toFixed(1)} m`,
          distance_quality: det.distance_quality,
          firstSeen: now,
          lastSeen: now,
          missedFrames: 0,
          smoothedConf: det.confidence,
          smoothedDistM: det.distance_m,
          smoothedBbox: [...det.bbox] as [number, number, number, number],
        });
      }
    });

    // 2. Handle unmatched objects: increment missed frames and remove expired ones
    const activeDetections: DetectionObject[] = [];
    this.trackedMap.forEach((entry, key) => {
      if (!currentFrameMatchedKeys.has(key)) {
        entry.missedFrames += 1;
      }

      if (entry.missedFrames <= this.maxMissedFrames) {
        activeDetections.push({
          object_name: entry.object_name,
          confidence: roundDec(entry.smoothedConf, 4),
          bbox: entry.smoothedBbox,
          track_id: entry.track_id,
          distance_m: entry.smoothedDistM,
          distance_display: entry.distance_display,
          distance_quality: entry.distance_quality,
        });
      } else {
        // Purge expired tracked object
        this.trackedMap.delete(key);
      }
    });

    return activeDetections;
  }

  /**
   * Resets all internal temporal tracking states.
   */
  public reset(): void {
    this.trackedMap.clear();
  }

  /**
   * Fallback spatial matching for detections without a ByteTrack ID.
   */
  private findSpatialMatchKey(det: DetectionObject): string {
    let bestKey = '';
    let minDistance = Infinity;

    const [x1, y1, x2, y2] = det.bbox;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    this.trackedMap.forEach((existing, key) => {
      if (existing.object_name.toLowerCase() === det.object_name.toLowerCase()) {
        const [ex1, ey1, ex2, ey2] = existing.smoothedBbox;
        const ecx = (ex1 + ex2) / 2;
        const ecy = (ey1 + ey2) / 2;
        const dist = Math.hypot(cx - ecx, cy - ecy);
        if (dist < minDistance && dist < 120) { // Within 120px bounding box center proximity
          minDistance = dist;
          bestKey = key;
        }
      }
    });

    return bestKey || `spatial_${det.object_name}_${Math.round(cx)}_${Math.round(cy)}`;
  }
}

function roundDec(val: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}
