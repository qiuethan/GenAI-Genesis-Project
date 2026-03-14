"""HTTP server for composition assessment over USB.

The iPhone app sends JPEG frames via POST, and receives
composition scores as JSON responses.

Usage:
    python -m server.server                  # default: MPS, port 8420
    python -m server.server --port 8420      # custom port
    python -m server.server --device cpu     # force CPU
"""

from __future__ import annotations

import argparse
import io
import json
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

import cv2
from PIL import Image, ImageOps
import numpy as np

from .inference.predictor import CompositionPredictor
from .pipeline.auto_exposure import AutoExposureController
from .setup_model import download_model, MODEL_PATH

# Global instances (initialized in main)
_predictor: CompositionPredictor | None = None
_ae: AutoExposureController | None = None


def _decode_jpeg_with_exif(jpeg_bytes: bytes) -> np.ndarray:
    """Decode JPEG and apply EXIF orientation using Pillow.

    Pillow's exif_transpose handles all 8 EXIF orientation values correctly,
    including mirroring. Returns a BGR numpy array ready for OpenCV/inference.
    """
    pil_img = Image.open(io.BytesIO(jpeg_bytes))
    pil_img = ImageOps.exif_transpose(pil_img)
    # Convert to BGR for OpenCV
    rgb = np.array(pil_img)
    if rgb.ndim == 2:
        return cv2.cvtColor(rgb, cv2.COLOR_GRAY2BGR)
    return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)


class CompositionHandler(BaseHTTPRequestHandler):
    """Handles /analyze (POST) and /health (GET) endpoints."""

    def do_GET(self):
        if self.path == '/health':
            self._json_response(200, {
                'status': 'ok',
                'model_loaded': _predictor is not None,
            })
        else:
            self._json_response(404, {'error': 'not found'})

    def do_POST(self):
        if self.path == '/score':
            return self._handle_score()
        if self.path != '/analyze':
            self._json_response(404, {'error': 'not found'})
            return

        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._json_response(400, {'error': 'empty body'})
            return

        jpeg_data = self.rfile.read(content_length)

        # Decode JPEG with correct EXIF orientation via Pillow
        try:
            frame = _decode_jpeg_with_exif(jpeg_data)
        except Exception:
            self._json_response(400, {'error': 'invalid image'})
            return

        # Blur rejection — skip frames that are too blurry for reliable scoring
        BLUR_THRESHOLD = 30.0  # Laplacian variance; below this = too blurry
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < BLUR_THRESHOLD:
            print(f"[Analyze] {frame.shape[1]}x{frame.shape[0]} SKIPPED (blur={blur_score:.1f} < {BLUR_THRESHOLD})")
            self._json_response(200, {'skipped': True, 'reason': 'too_blurry', 'blur': round(blur_score, 1)})
            return

        t0 = time.perf_counter()
        result = _predictor.predict(frame)
        dt = time.perf_counter() - t0

        result['inference_ms'] = round(dt * 1000, 1)
        result['blur'] = round(blur_score, 1)

        # Save incoming frames with timestamp and score
        debug_dir = os.path.join(os.path.dirname(__file__), 'debug_frames')
        os.makedirs(debug_dir, exist_ok=True)
        ts = time.strftime("%H%M%S")
        score = result['score']
        label = result['label']
        filename = f"{ts}_score{score}_{label}_{frame.shape[1]}x{frame.shape[0]}.jpg"
        cv2.imwrite(os.path.join(debug_dir, filename), frame)

        print(f"[Analyze] {frame.shape[1]}x{frame.shape[0]} -> {score}/100 ({label}) blur={blur_score:.0f} in {result['inference_ms']:.0f}ms")
        self._json_response(200, result)

    def _handle_score(self):
        """Lightweight scoring for gallery images — no blur check, no debug save."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._json_response(400, {'error': 'empty body'})
            return

        jpeg_data = self.rfile.read(content_length)
        try:
            frame = _decode_jpeg_with_exif(jpeg_data)
        except Exception:
            self._json_response(400, {'error': 'invalid image'})
            return

        t0 = time.perf_counter()
        result = _predictor.predict(frame)
        dt = time.perf_counter() - t0
        result['inference_ms'] = round(dt * 1000, 1)
        self._json_response(200, result)

    def _json_response(self, status: int, data: dict):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Log all requests
        super().log_message(format, *args)


def main():
    global _predictor

    parser = argparse.ArgumentParser(description="Composition assessment HTTP server")
    parser.add_argument("--port", type=int, default=8420, help="Port (default: 8420)")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--device", default="mps", help="Torch device: mps, cpu, cuda")
    parser.add_argument("--checkpoint", default=None, help="Path to samp_net.pth")
    parser.add_argument("--no-ae", action="store_true", help="Disable auto-exposure")
    args = parser.parse_args()

    # Resolve checkpoint
    checkpoint = args.checkpoint or MODEL_PATH
    if not os.path.exists(checkpoint):
        print("Pretrained model not found. Downloading...")
        checkpoint = download_model()

    # Validate device
    import torch
    device = args.device
    if device == "mps" and not torch.backends.mps.is_available():
        print("MPS not available, falling back to CPU")
        device = "cpu"
    elif device == "cuda" and not torch.cuda.is_available():
        print("CUDA not available, falling back to CPU")
        device = "cpu"

    # Load model
    _predictor = CompositionPredictor(checkpoint, device=device)

    # Auto-exposure
    if not args.no_ae:
        _ae = AutoExposureController()
        print("[Server] Auto-exposure enabled (center-weighted metering)")

    # Start server
    server = HTTPServer((args.host, args.port), CompositionHandler)
    print(f"\n[Server] Composition assessment server running on http://{args.host}:{args.port}")
    print(f"[Server] POST /analyze  - send JPEG, get composition score")
    print(f"[Server] GET  /health   - health check")
    print(f"[Server] Press Ctrl+C to stop\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Server] Shutting down...")
        server.server_close()


if __name__ == "__main__":
    main()
