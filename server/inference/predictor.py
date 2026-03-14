"""TANet inference wrapper with directional probing and score tracking."""

from __future__ import annotations

from collections import deque

import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms as T

from ..model.tanet import TANet

IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]

CROP_FRACTION = 0.10

DIRECTION_MAP = {
    'left':  'Try moving right',
    'right': 'Try moving left',
    'up':    'Try tilting down',
    'down':  'Try tilting up',
}


def _patch_adaptive_pool_for_mps():
    _orig = F.adaptive_avg_pool2d

    def _safe(input, output_size):
        if input.is_mps:
            try:
                return _orig(input, output_size)
            except RuntimeError:
                return _orig(input.cpu(), output_size).to("mps")
        return _orig(input, output_size)

    F.adaptive_avg_pool2d = _safe


class ScoreTracker:
    """Tracks score history to detect trend and peak."""

    def __init__(self, window: int = 6):
        self.history = deque(maxlen=window)
        self.peak_score = 0.0
        self.peak_age = 0          # how many frames since the peak
        self.direction = None      # last suggested direction

    def update(self, score: float, direction: str | None):
        self.history.append(score)
        self.peak_age += 1

        if score >= self.peak_score - 0.002:
            # New peak (or within noise of peak)
            self.peak_score = max(self.peak_score, score)
            self.peak_age = 0

        if direction:
            self.direction = direction

    @property
    def trend(self) -> str:
        """Return 'improving', 'stable', or 'declining'."""
        if len(self.history) < 3:
            return 'stable'
        recent = list(self.history)
        first_half = np.mean(recent[:len(recent) // 2])
        second_half = np.mean(recent[len(recent) // 2:])
        diff = second_half - first_half
        if diff > 0.003:
            return 'improving'
        elif diff < -0.003:
            return 'declining'
        return 'stable'

    def get_guidance(self, probe_suggestion: str | None) -> str | None:
        """Combine probe direction with score trend into final guidance."""
        trend = self.trend

        # If we're declining and we had a peak recently, tell user to go back
        if trend == 'declining' and self.peak_age > 2 and self.direction:
            # Reverse the last direction
            reverse = {
                'Try moving right': 'Go back left',
                'Try moving left': 'Go back right',
                'Try tilting down': 'Tilt back up',
                'Try tilting up': 'Tilt back down',
            }
            return reverse.get(self.direction, None)

        # If stable near peak, hold position
        if trend == 'stable' and self.peak_age <= 2:
            return None  # no suggestion = "hold here"

        # If improving, keep going in the current direction
        if trend == 'improving' and self.direction:
            return self.direction

        # Otherwise use the probe suggestion
        return probe_suggestion

    def reset_if_scene_changed(self, score: float):
        """If score jumps dramatically, reset tracking (user moved to new scene)."""
        if len(self.history) > 0:
            last = self.history[-1]
            if abs(score - last) > 0.05:
                self.history.clear()
                self.peak_score = score
                self.peak_age = 0
                self.direction = None


class ImagePredictor:
    """TANet aesthetic predictor with directional guidance and score tracking."""

    def __init__(self, checkpoint_path: str, places365_path: str, device: str = 'mps'):
        self.device = torch.device(device)
        self.image_size = 224

        if device == 'mps':
            _patch_adaptive_pool_for_mps()

        self.model = TANet(places365_path=places365_path)
        state_dict = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()
        print(f"[Predictor] TANet loaded on {self.device}")

        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((self.image_size, self.image_size)),
            T.ToTensor(),
            T.Normalize(mean=IMAGE_NET_MEAN, std=IMAGE_NET_STD),
        ])

        self._request_count = 0
        self._probe_interval = 3
        self._tracker = ScoreTracker()

        self._warmup()

    def _warmup(self):
        dummy = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        self._predict_fast(dummy)
        print("[Predictor] Warmup complete")

    def _to_tensor(self, frame_bgr: np.ndarray) -> torch.Tensor:
        rgb = frame_bgr[:, :, ::-1].copy()
        return self.transform(rgb)

    @torch.no_grad()
    def predict(self, frame_bgr: np.ndarray) -> dict:
        self._request_count += 1
        should_probe = (self._request_count % self._probe_interval) == 0

        if should_probe:
            score, probe_suggestion = self._probe(frame_bgr)
        else:
            score = self._score_single(frame_bgr)
            probe_suggestion = None

        # Track and get final guidance
        self._tracker.reset_if_scene_changed(score)
        suggestion = self._tracker.get_guidance(probe_suggestion)
        self._tracker.update(score, probe_suggestion)

        return {
            'score': round(score * 100, 1),
            'suggestion': suggestion,
            'trend': self._tracker.trend,
        }

    def _score_single(self, frame_bgr: np.ndarray) -> float:
        tensor = self._to_tensor(frame_bgr).unsqueeze(0).to(self.device)
        return float(self.model(tensor).item())

    def _predict_fast(self, frame_bgr: np.ndarray) -> dict:
        score = self._score_single(frame_bgr)
        return {'score': score, 'suggestion': None, 'trend': 'stable'}

    def _probe(self, frame_bgr: np.ndarray) -> tuple[float, str | None]:
        """Score center + 4 directional crops. Returns (center_score, suggestion)."""
        h, w = frame_bgr.shape[:2]
        dh = int(h * CROP_FRACTION)
        dw = int(w * CROP_FRACTION)

        crops = [
            frame_bgr,
            frame_bgr[:, dw:, :],
            frame_bgr[:, :w - dw, :],
            frame_bgr[dh:, :, :],
            frame_bgr[:h - dh, :, :],
        ]
        names = ['center', 'left', 'right', 'up', 'down']

        batch = torch.stack([self._to_tensor(c) for c in crops]).to(self.device)
        scores = [float(s.item()) for s in self.model(batch)]
        score_map = dict(zip(names, scores))

        center_score = score_map['center']
        best_dir = max(score_map, key=score_map.get)
        best_score = score_map[best_dir]

        suggestion = None
        if best_dir != 'center' and (best_score - center_score) > 0.005:
            suggestion = DIRECTION_MAP[best_dir]

        return center_score, suggestion
