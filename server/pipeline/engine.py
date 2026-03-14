"""3-thread pipeline engine: capture, inference, display."""

import os
import threading
import time

import cv2

from ..inference.predictor import CompositionPredictor
from .capture import CaptureThread
from .display import draw_overlay


class PipelineEngine:
    """Orchestrates the 3-thread capture/inference/display pipeline."""

    def __init__(self, checkpoint_path: str, camera_id: int = 0,
                 device: str = 'mps'):
        self.capture = CaptureThread(camera_id=camera_id)
        self.predictor = CompositionPredictor(checkpoint_path, device=device)

        # Shared state
        self._latest_result = None
        self._result_lock = threading.Lock()
        self._inference_running = False

        # Display state
        self._show_grid = False
        self._display_fps = 0.0
        self._inference_fps = 0.0
        self._screenshot_dir = "screenshots"

    def run(self):
        """Start the pipeline (blocks on display loop)."""
        self.capture.start()
        print("[Engine] Capture started")

        # Start inference thread
        self._inference_running = True
        inference_thread = threading.Thread(target=self._inference_loop, daemon=True)
        inference_thread.start()
        print("[Engine] Inference thread started")

        # Display loop (main thread)
        print("[Engine] Display loop running. Press Q to quit.")
        self._display_loop()

        # Cleanup
        self._inference_running = False
        inference_thread.join(timeout=3.0)
        self.capture.stop()
        cv2.destroyAllWindows()
        print("[Engine] Shutdown complete")

    def _inference_loop(self):
        """Background thread: runs SAMP-Net on latest frame."""
        while self._inference_running:
            frame = self.capture.get_frame()
            if frame is None:
                time.sleep(0.01)
                continue

            t0 = time.perf_counter()
            result = self.predictor.predict(frame)
            dt = time.perf_counter() - t0

            with self._result_lock:
                self._latest_result = result
                self._inference_fps = 1.0 / max(dt, 1e-6)

    def _display_loop(self):
        """Main thread: composites camera feed + overlay."""
        frame_count = 0
        fps_t0 = time.perf_counter()

        while True:
            frame = self.capture.get_frame()
            if frame is None:
                time.sleep(0.01)
                continue

            # Get latest inference result
            with self._result_lock:
                result = self._latest_result
                inf_fps = self._inference_fps

            # Composite overlay
            display = draw_overlay(frame, result, self._show_grid,
                                   self._display_fps, inf_fps)
            cv2.imshow("Composition Assessment", display)

            # FPS tracking
            frame_count += 1
            elapsed = time.perf_counter() - fps_t0
            if elapsed >= 1.0:
                self._display_fps = frame_count / elapsed
                frame_count = 0
                fps_t0 = time.perf_counter()

            # Keyboard handling
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('g'):
                self._show_grid = not self._show_grid
            elif key == ord('s'):
                self._take_screenshot(frame, result)

    def _take_screenshot(self, frame, result):
        """Save current frame with overlay."""
        os.makedirs(self._screenshot_dir, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        score_str = f"{result.get('aesthetic_score', result.get('score', 0)):.2f}" if result else "unknown"
        filename = f"composition_{timestamp}_{score_str}.png"
        path = os.path.join(self._screenshot_dir, filename)
        cv2.imwrite(path, frame)
        print(f"[Screenshot] Saved: {path}")
