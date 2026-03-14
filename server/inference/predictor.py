"""SAMP-Net inference wrapper for real-time composition assessment."""

import os

import numpy as np
import torch
import torch.nn.functional as F
import torchvision.transforms as T

from ..config import Config
from ..model.samp_net import SAMPNet
from .saliency import detect_saliency

IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]


def _patch_adaptive_pool_for_mps():
    """Patch adaptive_avg_pool2d to fall back to CPU when MPS can't handle it.

    MPS requires input sizes to be divisible by output sizes, which SAMP-Net's
    pattern modules violate (e.g. 7x7 input pooled to 2x2, 3x3, etc.).
    """
    _orig = F.adaptive_avg_pool2d

    def _safe_adaptive_avg_pool2d(input, output_size):
        if input.is_mps:
            try:
                return _orig(input, output_size)
            except RuntimeError:
                return _orig(input.cpu(), output_size).to("mps")
        return _orig(input, output_size)

    F.adaptive_avg_pool2d = _safe_adaptive_avg_pool2d


def _detect_resnet_variant(checkpoint_path: str) -> int:
    """Probe checkpoint to auto-detect ResNet variant from backbone.0.weight shape."""
    state = torch.load(checkpoint_path, map_location='cpu', weights_only=True)
    for key in state:
        if 'backbone.0.weight' in key:
            out_channels = state[key].shape[0]
            if out_channels == 64:
                # First conv is always 64 channels; check deeper layer
                break
    # Check last backbone layer's output channels
    max_channels = 0
    for key in state:
        if key.startswith('backbone.') and 'weight' in key and len(state[key].shape) >= 2:
            max_channels = max(max_channels, state[key].shape[0])
    if max_channels >= 2048:
        return 50
    return 18


class CompositionPredictor:
    """Real-time SAMP-Net composition quality predictor."""

    def __init__(self, checkpoint_path: str, device: str = 'mps'):
        self.device = torch.device(device)
        self.image_size = 224

        if device == 'mps':
            _patch_adaptive_pool_for_mps()

        # Auto-detect ResNet variant
        resnet_layers = _detect_resnet_variant(checkpoint_path)
        print(f"[Predictor] Detected ResNet-{resnet_layers} from checkpoint")

        # Build config and model
        cfg = Config()
        cfg.resnet_layers = resnet_layers
        self.model = SAMPNet(cfg, pretrained=False)
        state_dict = torch.load(checkpoint_path, map_location='cpu', weights_only=True)
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
        self.model.eval()
        print(f"[Predictor] Model loaded on {self.device}")

        # Preprocessing transform
        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((self.image_size, self.image_size)),
            T.ToTensor(),
            T.Normalize(mean=IMAGE_NET_MEAN, std=IMAGE_NET_STD),
        ])

        # Score levels for weighted mean
        self._score_levels = torch.arange(1, 6, dtype=torch.float32, device=self.device)

        # Remap range: raw model scores of ~1.5-3.5 spread to 0-100
        self._raw_floor = 1.5   # raw score that maps to 0
        self._raw_ceil = 3.5    # raw score that maps to 100

        # Warmup
        self._warmup()

    def _warmup(self):
        """Run a dummy inference to warm up MPS kernels."""
        dummy_img = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        self.predict(dummy_img)
        print("[Predictor] Warmup complete")

    @torch.no_grad()
    def predict(self, frame_bgr: np.ndarray) -> dict:
        """Run composition assessment on a single BGR frame.

        Returns dict with keys:
            score: float (1-5 weighted mean)
            distribution: list[float] (5 probabilities)
            label: str (Poor/Fair/Good/Excellent)
        """
        # Saliency on CPU (fast FFT-based)
        sal_map = detect_saliency(frame_bgr, target_size=(self.image_size, self.image_size))
        sal_tensor = torch.from_numpy(sal_map).unsqueeze(0).unsqueeze(0).to(self.device)

        # Image preprocessing
        frame_rgb = frame_bgr[:, :, ::-1].copy()  # BGR -> RGB
        img_tensor = self.transform(frame_rgb).unsqueeze(0).to(self.device)

        # Forward pass
        _weight, attribute, scores = self.model(img_tensor, sal_tensor)

        # Per-attribute composition reasoning
        attr_scores = attribute[0].cpu().numpy().tolist() if attribute is not None else []
        attributes = dict(zip(Config.attribute_types, attr_scores))

        # Compute weighted mean score
        dist = scores[0].cpu().numpy()
        raw_score = float((scores[0] * self._score_levels).sum().item())

        # Remap raw 1.5-3.5 range to 0-100
        normalized = (raw_score - self._raw_floor) / (self._raw_ceil - self._raw_floor)
        normalized = max(0.0, min(1.0, normalized))
        score = round(normalized * 100)

        # Quality label
        if score < 25:
            label = "Poor"
        elif score < 50:
            label = "Fair"
        elif score < 75:
            label = "Good"
        else:
            label = "Excellent"

        return {
            'score': score,
            'raw_score': round(raw_score, 3),
            'distribution': dist.tolist(),
            'label': label,
            'attributes': attributes,
        }
