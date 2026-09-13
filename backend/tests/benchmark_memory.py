import os
import sys
import time
import psutil
import numpy as np
from pathlib import Path

# Ensure backend folder is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

def get_process_memory_mb() -> float:
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)

def run_memory_benchmark():
    print("=" * 60)
    print(" VISIONEDGE AI - BACKEND RAM MEMORY BENCHMARK ")
    print(" Target limits: < 512 MB RAM (Render Free Tier)")
    print("=" * 60)

    # Stage A: Process Startup
    mem_startup = get_process_memory_mb()
    print(f" A. Process Startup RAM:   {mem_startup:.2f} MB")

    # Stage B: YOLO Model Loaded
    start_load = time.time()
    from ai.detection.yolo_detector import YOLODetector
    detector = YOLODetector.get_instance()
    load_time = (time.time() - start_load) * 1000
    mem_model_loaded = get_process_memory_mb()
    print(f" B. YOLO Model Loaded RAM: {mem_model_loaded:.2f} MB (Load time: {load_time:.1f} ms)")

    # Stage C: First Detection Run
    synthetic_img = np.ones((480, 640, 3), dtype=np.uint8) * 200
    start_det = time.time()
    det_results = detector.detect(synthetic_img)
    det_time = (time.time() - start_det) * 1000
    mem_detection = get_process_memory_mb()
    print(f" C. First Detection RAM:   {mem_detection:.2f} MB (Inference time: {det_time:.1f} ms)")

    # Stage D: ByteTrack Tracking
    from ai.tracking.byte_tracker import get_tracker_manager
    tracker = get_tracker_manager()
    start_track = time.time()
    for _ in range(5):
        track_results = tracker.track_objects(synthetic_img)
    track_time = (time.time() - start_track) * 1000 / 5
    mem_tracking = get_process_memory_mb()
    print(f" D. ByteTrack Active RAM:  {mem_tracking:.2f} MB (Avg track time: {track_time:.1f} ms)")

    # Stage E: Continuous Peak Inference Test (20 frames loop)
    peak_mem = mem_tracking
    for i in range(20):
        # Varying frame
        frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        _ = tracker.track_objects(frame)
        curr_mem = get_process_memory_mb()
        if curr_mem > peak_mem:
            peak_mem = curr_mem

    print(f" E. Peak Inference RAM:     {peak_mem:.2f} MB")
    print("=" * 60)

    # Verification against target limits
    print(" VERIFICATION AGAINST RENDER LIMITS (< 512 MB):")
    print(f" - Startup Target (< 300 MB): {'PASS' if mem_startup < 300 else 'WARN'} ({mem_startup:.1f} MB)")
    print(f" - Model Loaded Target (< 350 MB): {'PASS' if mem_model_loaded < 350 else 'WARN'} ({mem_model_loaded:.1f} MB)")
    print(f" - Normal Inference (< 400 MB): {'PASS' if mem_tracking < 400 else 'WARN'} ({mem_tracking:.1f} MB)")
    print(f" - Peak RAM (< 450 MB): {'PASS' if peak_mem < 450 else 'WARN'} ({peak_mem:.1f} MB)")
    print("=" * 60)

if __name__ == "__main__":
    run_memory_benchmark()
