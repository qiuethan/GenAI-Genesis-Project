"""TANet inference wrapper for image aesthetic assessment."""

import os

import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms as T

from ..model.tanet import TANet

IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]


def _patch_adaptive_pool_for_mps():
    """Patch adaptive_avg_pool2d to fall back to CPU when MPS can't handle it."""
    _orig = F.adaptive_avg_pool2d

    def _safe_adaptive_avg_pool2d(input, output_size):
        if input.is_mps:
            try:
                return _orig(input, output_size)
            except RuntimeError:
                return _orig(input.cpu(), output_size).to("mps")
        return _orig(input, output_size)

    F.adaptive_avg_pool2d = _safe_adaptive_avg_pool2d


class ImagePredictor:
    """TANet aesthetic quality predictor."""

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

        # Warmup
        self._warmup()

    def _warmup(self):
        dummy_img = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        self.predict(dummy_img)
        print("[Predictor] Warmup complete")

    @torch.no_grad()
    def predict(self, frame_bgr: np.ndarray) -> dict:
        """Score a BGR frame. Returns dict with raw 0-1 score."""
        frame_rgb = frame_bgr[:, :, ::-1].copy()
        img_tensor = self.transform(frame_rgb).unsqueeze(0).to(self.device)
        raw_score = float(self.model(img_tensor).item())

        return {
            'score': raw_score,
        }
