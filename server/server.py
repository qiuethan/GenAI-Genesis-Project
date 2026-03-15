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
import base64
import io
import json
import os
import threading
import time
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

import cv2
from PIL import Image, ImageOps
import numpy as np

from ultralytics import FastSAM

from .inference.predictor import ImagePredictor
from .setup_model import TANET_PATH, PLACES365_PATH, SAMP_PATH, COMP_CLASSIFIER_PATH

# Global instances (initialized in main)
_predictor: ImagePredictor | None = None
_fastsam: FastSAM | None = None
_gpu_lock = threading.Lock()


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
        if self.path == '/score-batch':
            return self._handle_score_batch()
        if self.path == '/classify-composition':
            return self._handle_classify_composition()
        if self.path == '/analyze-composition':
            return self._handle_analyze_composition()
        if self.path == '/edges':
            return self._handle_edges()
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
        BLUR_THRESHOLD = 250.0  # Laplacian variance; sharp frames are 400+, blurry <200
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
        if blur_score < BLUR_THRESHOLD:
            print(f"[Analyze] {frame.shape[1]}x{frame.shape[0]} SKIPPED (blur={blur_score:.1f} < {BLUR_THRESHOLD})")
            self._json_response(200, {'skipped': True, 'reason': 'too_blurry', 'blur': round(blur_score, 1)})
            return

        try:
            t0 = time.perf_counter()
            with _gpu_lock:
                result = _predictor.predict(frame)
            dt = time.perf_counter() - t0

            result['inference_ms'] = round(dt * 1000, 1)
            result['blur'] = round(blur_score, 1)

            # Save debug frame
            debug_dir = os.path.join(os.path.dirname(__file__), 'debug_frames')
            os.makedirs(debug_dir, exist_ok=True)
            ts = time.strftime("%H%M%S")
            aes = result['aesthetic_score']
            filename = f"{ts}_{aes}_{frame.shape[1]}x{frame.shape[0]}.jpg"
            cv2.imwrite(os.path.join(debug_dir, filename), frame)

            comp = result.get('composition_score', '?')
            ctype = result.get('composition_type', '?')
            print(f"[Analyze] {frame.shape[1]}x{frame.shape[0]} -> aesthetic={aes} comp={comp} type={ctype} in {result['inference_ms']:.0f}ms")
            self._json_response(200, result)
        except Exception as e:
            print(f"[Analyze] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_classify_composition(self):
        """Classify composition technique using local ResNet-18 model."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._json_response(400, {'error': 'empty body'})
            return

        jpeg_data = self.rfile.read(content_length)
        try:
            frame = _decode_jpeg_with_exif(jpeg_data)
            t0 = time.perf_counter()
            with _gpu_lock:
                result = _predictor.predict(frame)
            dt = time.perf_counter() - t0

            composition_type = result.get('composition_type')
            print(f"[Classify] {composition_type} in {dt*1000:.0f}ms")
            self._json_response(200, {
                'composition_type': composition_type,
                'classify_ms': round(dt * 1000, 1),
            })
        except Exception as e:
            print(f"[Classify] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_analyze_composition(self):
        """Run Gemini image gen to draw composition lines on photo (~10-17s)."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._json_response(400, {'error': 'empty body'})
            return

        jpeg_data = self.rfile.read(content_length)

        try:
            import base64
            from .inference.gemini import analyze_composition_with_gemini

            t0 = time.perf_counter()
            annotated = analyze_composition_with_gemini(jpeg_data)
            dt = time.perf_counter() - t0

            if annotated is None:
                self._json_response(500, {'error': 'Gemini returned no image'})
                return

            print(f"[AnalyzeComp] gemini={dt*1000:.0f}ms")
            self._json_response(200, {
                'annotated_image': base64.b64encode(annotated).decode('utf-8'),
                'gemini_ms': round(dt * 1000, 1),
            })
        except Exception as e:
            traceback.print_exc()
            self._json_response(500, {'error': str(e)})

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

        try:
            t0 = time.perf_counter()
            with _gpu_lock:
                result = _predictor.predict(frame)
            dt = time.perf_counter() - t0
            result['inference_ms'] = round(dt * 1000, 1)
            aes = result.get('aesthetic_score', '?')
            comp = result.get('composition_score', '?')
            pattern = result.get('dominant_pattern_name', '?')
            attrs = result.get('attributes', {})
            attr_str = ', '.join(f"{k}={v:.2f}" for k, v in attrs.items()) if attrs else 'none'
            print(f"[Score] {frame.shape[1]}x{frame.shape[0]} -> aesthetic={aes} comp={comp} pattern={pattern} attrs=[{attr_str}] in {result['inference_ms']:.0f}ms")
            self._json_response(200, result)
        except Exception as e:
            print(f"[Score] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_edges(self):
        """Return FastSAM segmentation outlines as PNG (black edges on transparent bg)."""
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

        try:
            t0 = time.perf_counter()
            h, w = frame.shape[:2]

            with _gpu_lock:
                results = _fastsam(frame, verbose=False, conf=0.4, iou=0.9)
            r = results[0]

            rgba = np.zeros((h, w, 4), dtype=np.uint8)
            seg_count = 0
            if r.masks is not None:
                for mask in r.masks.data.cpu().numpy():
                    mask_resized = cv2.resize(mask, (w, h), interpolation=cv2.INTER_LINEAR)
                    binary = (mask_resized > 0.5).astype(np.uint8)
                    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                    cv2.drawContours(rgba, contours, -1, (0, 0, 0, 255), 3)
                seg_count = len(r.masks)

            # Gaussian smoothing on the edge map to round out jagged contours
            alpha = rgba[:, :, 3]
            alpha = cv2.GaussianBlur(alpha, (21, 21), 0)
            _, alpha = cv2.threshold(alpha, 80, 255, cv2.THRESH_BINARY)
            rgba[:, :, 3] = alpha

            _, png_buf = cv2.imencode('.png', rgba)
            b64 = base64.b64encode(png_buf.tobytes()).decode('utf-8')

            dt = time.perf_counter() - t0
            print(f"[Edges] {w}x{h} -> {seg_count} segments, {len(b64) // 1024}KB PNG in {dt*1000:.0f}ms")
            self._json_response(200, {'edge_image': b64, 'width': w, 'height': h})
        except Exception as e:
            print(f"[Edges] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_score_batch(self):
        """Batch scoring for multiple gallery images via multipart/form-data."""
        import cgi

        content_type = self.headers.get('Content-Type', '')
        if 'multipart/form-data' not in content_type:
            self._json_response(400, {'error': 'expected multipart/form-data'})
            return

        # Parse multipart form data
        environ = {
            'REQUEST_METHOD': 'POST',
            'CONTENT_TYPE': content_type,
            'CONTENT_LENGTH': self.headers.get('Content-Length', '0'),
        }
        form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ=environ)

        # Collect image fields (image_0, image_1, ...)
        image_fields = []
        i = 0
        while True:
            key = f'image_{i}'
            if key not in form:
                break
            image_fields.append(form[key])
            i += 1

        if not image_fields:
            self._json_response(400, {'error': 'no images provided'})
            return

        MAX_BATCH = 10
        if len(image_fields) > MAX_BATCH:
            self._json_response(400, {'error': f'max {MAX_BATCH} images per batch'})
            return

        # Decode each image, track failures
        frames = []
        errors = {}  # index -> error string
        for idx, field in enumerate(image_fields):
            try:
                jpeg_data = field.file.read() if hasattr(field, 'file') else field.value
                if isinstance(jpeg_data, str):
                    jpeg_data = jpeg_data.encode('latin-1')
                frames.append(_decode_jpeg_with_exif(jpeg_data))
            except Exception:
                frames.append(None)
                errors[idx] = 'invalid image'

        valid_frames = [f for f in frames if f is not None]

        try:
            t0 = time.perf_counter()
            with _gpu_lock:
                if valid_frames:
                    batch_results = _predictor.predict_batch(valid_frames)
                else:
                    batch_results = []
            dt = time.perf_counter() - t0

            # Merge results back in order
            results = []
            valid_idx = 0
            for idx in range(len(frames)):
                if idx in errors:
                    results.append({'error': errors[idx]})
                else:
                    r = batch_results[valid_idx]
                    r['inference_ms'] = round(dt * 1000, 1)
                    results.append(r)
                    valid_idx += 1

            n = len(valid_frames)
            print(f"[ScoreBatch] {n} images in {dt*1000:.0f}ms ({len(errors)} failed)")
            self._json_response(200, {'results': results})
        except Exception as e:
            print(f"[ScoreBatch] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

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
    global _predictor, _fastsam

    parser = argparse.ArgumentParser(description="Image assessment HTTP server")
    parser.add_argument("--port", type=int, default=8420, help="Port (default: 8420)")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    parser.add_argument("--device", default="mps", help="Torch device: mps, cpu, cuda")
    args = parser.parse_args()

    # Validate device
    import torch
    device = args.device
    if device == "mps" and not torch.backends.mps.is_available():
        print("MPS not available, falling back to CPU")
        device = "cpu"
    elif device == "cuda" and not torch.cuda.is_available():
        print("CUDA not available, falling back to CPU")
        device = "cpu"

    # Load models
    _predictor = ImagePredictor(TANET_PATH, PLACES365_PATH, samp_checkpoint_path=SAMP_PATH, comp_classifier_path=COMP_CLASSIFIER_PATH, device=device)
    _fastsam = FastSAM('FastSAM-s.pt')
    print(f"[Server] FastSAM-s loaded")

    # Start threaded server so health checks don't block during inference
    class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
        daemon_threads = True

    server = ThreadedHTTPServer((args.host, args.port), CompositionHandler)
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
