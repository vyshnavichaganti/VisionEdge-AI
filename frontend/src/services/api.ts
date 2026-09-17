export interface DetectionObject {
  object_name: string;
  confidence: number;
  bbox: [number, number, number, number];
  track_id: number | null;
  distance_m: number;
  distance_display: string;
  distance_quality: string;
}

export interface SummaryData {
  total_objects: number;
  people_count: number;
  scene_status: string;
  tracking_status: string;
}

export interface DetectionResponse {
  objects: DetectionObject[];
  inference_time_ms: number;
  summary: SummaryData;
}

export interface HealthResponse {
  status: string;
  app: string;
  version: string;
}

export interface ReadyResponse {
  status: string;
  model_loaded: boolean;
  device: string;
}

const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://visionedge-ai-4jrg.onrender.com'
    : 'http://localhost:8000');
const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

export async function detectObjects(imageBlob: Blob): Promise<DetectionResponse> {
  const formData = new FormData();
  formData.append('file', imageBlob, 'frame.jpg');

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/detect`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errDetail = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson.detail) errDetail = errJson.detail;
      } catch (_) {}
      throw new Error(`Detection request failed: ${errDetail}`);
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === 'TypeError') {
      throw new Error('Backend server is offline or unreachable. Please check connection.');
    }
    throw err;
  }
}

export async function resetTracking(): Promise<{ status: string; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/reset-tracking`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Reset tracking failed (${response.status})`);
    }

    return await response.json();
  } catch (err: any) {
    console.error('API resetTracking error:', err);
    throw err;
  }
}

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}

export async function checkReadiness(): Promise<ReadyResponse> {
  const response = await fetch(`${API_BASE_URL}/ready`);
  if (!response.ok) {
    throw new Error(`Readiness check failed (${response.status})`);
  }
  return response.json();
}
