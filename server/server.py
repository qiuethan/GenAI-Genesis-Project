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
from socketserver import ThreadingMixIn

import cv2
from PIL import Image, ImageOps
import numpy as np

from .inference.predictor import ImagePredictor
from .inference.detector import ObjectDetector
from .setup_model import TANET_PATH, PLACES365_PATH, SAMP_PATH

# Global instances (initialized in main)
_predictor: ImagePredictor | None = None
_detector: ObjectDetector | None = None


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
        if self.path == '/detect':
            return self._handle_detect()
        if self.path == '/score':
            return self._handle_score()
        if self.path == '/scan':
            return self._handle_scan()
        if self.path == '/analyze-composition':
            return self._handle_analyze_composition()
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
            pattern = result.get('dominant_pattern_name', '?')
            attrs = result.get('attributes', {})
            attr_str = ', '.join(f"{k}={v:.2f}" for k, v in attrs.items()) if attrs else 'none'
            print(f"[Analyze] {frame.shape[1]}x{frame.shape[0]} -> aesthetic={aes} comp={comp} pattern={pattern} attrs=[{attr_str}] in {result['inference_ms']:.0f}ms")
            self._json_response(200, result)
        except Exception as e:
            print(f"[Analyze] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_detect(self):
        """Detect all objects in a frame using YOLO. Used when entering scan mode."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._json_response(400, {'error': 'empty body'})
            return

        jpeg_data = self.rfile.read(content_length)
        try:
            frame = _decode_jpeg_with_exif(jpeg_data)
            objects = _detector.detect(frame)
            print(f"[Detect] {frame.shape[1]}x{frame.shape[0]} -> {len(objects)} objects")
            self._json_response(200, {'objects': objects})
        except Exception as e:
            print(f"[Detect] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_scan(self):
        """Score a frame and check if selected objects are present using YOLO."""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length == 0:
            self._json_response(400, {'error': 'empty body'})
            return

        try:
            jpeg_data = self.rfile.read(content_length)
            frame = _decode_jpeg_with_exif(jpeg_data)

            # Parse target objects from query string
            from urllib.parse import urlparse, parse_qs
            query = parse_qs(urlparse(self.path).query)
            targets_json = query.get('targets', ['[]'])[0]
            import json
            targets = json.loads(targets_json)

            # Check if all target objects are in frame
            check = _detector.check_objects_in_frame(frame, targets)

            # Score the frame
            score_result = _predictor.predict(frame)

            aes = score_result.get('aesthetic_score', '?')
            comp = score_result.get('composition_score', '?')
            pattern = score_result.get('dominant_pattern_name', '?')
            print(f"[Scan] {frame.shape[1]}x{frame.shape[0]} -> aesthetic={aes} comp={comp} pattern={pattern} objects_found={check['all_found']} missing={check['missing']}")

            self._json_response(200, {
                'aesthetic_score': score_result['aesthetic_score'],
                'score': score_result['score'],
                'all_objects_found': check['all_found'],
                'found_objects': check['found_objects'],
                'missing': check['missing'],
            })
        except Exception as e:
            print(f"[Scan] ERROR: {e}")
            self._json_response(500, {'error': str(e)})

    def _handle_analyze_composition(self):
        """Run SAMP-Net + Gemini to produce composition-annotated image."""
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
            import base64
            from .inference.gemini import analyze_composition_with_gemini

            # Run SAMP-Net to get composition info
            t0 = time.perf_counter()
            result = _predictor.predict(frame)
            dt_model = time.perf_counter() - t0

            composition_type = result.get('dominant_pattern_name', 'Rule of Thirds')
            attributes = result.get('attributes', {})

            # Re-encode frame as JPEG for Gemini
            _, jpeg_buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            image_bytes = jpeg_buf.tobytes()

            # Call Gemini
            t1 = time.perf_counter()
            annotated = analyze_composition_with_gemini(image_bytes, composition_type, attributes)
            dt_gemini = time.perf_counter() - t1

            if annotated is None:
                self._json_response(500, {'error': 'Gemini returned no image'})
                return

            response_data = {
                'annotated_image': base64.b64encode(annotated).decode('utf-8'),
                'composition_type': composition_type,
                'composition_score': result.get('composition_score'),
                'attributes': attributes,
                'model_ms': round(dt_model * 1000, 1),
                'gemini_ms': round(dt_gemini * 1000, 1),
            }
            print(f"[AnalyzeComp] {composition_type} | model={dt_model*1000:.0f}ms gemini={dt_gemini*1000:.0f}ms")
            self._json_response(200, response_data)
        except Exception as e:
            print(f"[AnalyzeComp] ERROR: {e}")
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
    global _predictor, _detector

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
    _predictor = ImagePredictor(TANET_PATH, PLACES365_PATH, samp_checkpoint_path=SAMP_PATH, device=device)
    _detector = ObjectDetector(device=device)

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
