"""TANet + SAMP-Net inference wrapper — aesthetic and composition scoring."""

from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F
import torchvision.models as models
import torchvision.transforms as T

from ..model.tanet import TANet
from ..model.samp_net import SAMPNet
from ..config import Config as SAMPConfig
from .saliency import detect_saliency

IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]

PATTERN_NAMES = [
    'Horizontal',
    'Vertical',
    'Upper Triangle',
    'Lower Triangle',
    'Center/Surround',
    'Quadrants',
    'Diagonal Cross',
    'Rule of Thirds',
]

ATTRIBUTE_NAMES = [
    'RuleOfThirds',
    'BalancingElements',
    'DoF',
    'Object',
    'Symmetry',
    'Repetition',
]

# Model class -> app overlay type (only classes with overlays)
COMP_CLASS_TO_OVERLAY = {
    'rule_of_thirds': 'rule_of_thirds',
    'symmetric': 'symmetry',
    'diagonal': 'diagonals',
    'golden_ratio': 'golden_ratio',
    'triangle': 'triangles',
}


def _patch_adaptive_pool_for_mps():
    """Patch adaptive pooling ops to fall back to CPU for non-divisible sizes on MPS."""
    _c_avg = torch._C._nn.adaptive_avg_pool2d
    _c_max = torch._C._nn.adaptive_max_pool2d

    def _safe_avg(input, output_size):
        if input.device.type == 'mps':
            os_ = torch.nn.modules.utils._pair(output_size)
            h, w = input.shape[-2], input.shape[-1]
            if (h % os_[0] != 0) or (w % os_[1] != 0):
                return _c_avg(input.cpu(), os_).to(input.device)
        return _c_avg(input, output_size)

    def _safe_max(input, output_size):
        if input.device.type == 'mps':
            os_ = torch.nn.modules.utils._pair(output_size)
            h, w = input.shape[-2], input.shape[-1]
            if (h % os_[0] != 0) or (w % os_[1] != 0):
                result = _c_max(input.cpu(), os_)
                return (result[0].to(input.device), result[1].to(input.device))
        return _c_max(input, output_size)

    torch._C._nn.adaptive_avg_pool2d = _safe_avg
    torch._C._nn.adaptive_max_pool2d = _safe_max


class ImagePredictor:
    """TANet aesthetic + SAMP-Net composition predictor."""

    def __init__(self, checkpoint_path: str, places365_path: str,
                 samp_checkpoint_path: str | None = None,
                 comp_classifier_path: str | None = None,
                 device: str = 'mps'):
        self.device = torch.device(device)
        self.image_size = 224

        if device == 'mps':
            _patch_adaptive_pool_for_mps()

        # TANet (aesthetic quality)
        self.tanet = TANet(places365_path=places365_path)
        state_dict = torch.load(checkpoint_path, map_location='cpu', weights_only=False)
        self.tanet.load_state_dict(state_dict)
        self.tanet.to(self.device)
        self.tanet.eval()
        print(f"[Predictor] TANet loaded on {self.device}")

        # SAMP-Net (composition)
        self.samp_model = None
        if samp_checkpoint_path:
            cfg = SAMPConfig()
            self.samp_model = SAMPNet(cfg, pretrained=False)
            state_dict = torch.load(samp_checkpoint_path, map_location='cpu', weights_only=True)
            self.samp_model.load_state_dict(state_dict)
            self.samp_model.to(self.device)
            self.samp_model.eval()
            print(f"[Predictor] SAMP-Net loaded on {self.device}")

        # Composition classifier (ResNet-18, 11-class)
        self.comp_classifier = None
        self.comp_types: list[str] = []
        if comp_classifier_path:
            checkpoint = torch.load(comp_classifier_path, map_location='cpu', weights_only=False)
            self.comp_types = checkpoint.get('comp_types', [])
            num_classes = len(self.comp_types)
            self.comp_classifier = models.resnet18(weights=None)
            self.comp_classifier.fc = torch.nn.Linear(512, num_classes)
            self.comp_classifier.load_state_dict(checkpoint['model_state_dict'])
            self.comp_classifier.to(self.device)
            self.comp_classifier.eval()
            print(f"[Predictor] Composition classifier loaded on {self.device} ({num_classes} classes)")

        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((self.image_size, self.image_size)),
            T.ToTensor(),
            T.Normalize(mean=IMAGE_NET_MEAN, std=IMAGE_NET_STD),
        ])

        self._warmup()

    def _warmup(self):
        dummy = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        self.predict(dummy)
        print("[Predictor] Warmup complete")

    def _to_tensor(self, frame_bgr: np.ndarray) -> torch.Tensor:
        rgb = frame_bgr[:, :, ::-1].copy()
        return self.transform(rgb).unsqueeze(0).to(self.device)

    def _predict_tanet(self, tensor: torch.Tensor) -> dict:
        score = round(float(self.tanet(tensor).item()) * 100, 1)
        return {'aesthetic_score': score, 'score': score}

    def _predict_composition_type(self, tensor: torch.Tensor) -> dict:
        logits = self.comp_classifier(tensor)  # [1, num_classes]
        probs = F.softmax(logits, dim=1)[0]
        idx = int(probs.argmax().item())
        raw_class = self.comp_types[idx]
        app_type = COMP_CLASS_TO_OVERLAY.get(raw_class)
        return {'composition_type': app_type}

    def _predict_samp(self, tensor: torch.Tensor, frame_bgr: np.ndarray) -> dict:
        # Compute saliency map
        sal_map = detect_saliency(frame_bgr)
        sal_tensor = torch.from_numpy(sal_map).unsqueeze(0).unsqueeze(0).to(self.device)

        weight, attribute, scores = self.samp_model(tensor, sal_tensor)

        # Composition score: weighted mean of distribution * [1,2,3,4,5], mapped to 0-100
        levels = torch.arange(1, 6, dtype=torch.float32, device=self.device)
        weighted_mean = float((scores[0] * levels).sum().item())
        composition_score = round((weighted_mean - 1) / 4 * 100, 1)

        # Attributes
        attributes = {}
        if attribute is not None:
            for i, name in enumerate(ATTRIBUTE_NAMES):
                attributes[name] = round(float(attribute[0, i].item()), 3)

        return {
            'composition_score': composition_score,
            'distribution': [round(float(s), 4) for s in scores[0].cpu().tolist()],
            'attributes': attributes,
        }

    @torch.no_grad()
    def predict(self, frame_bgr: np.ndarray) -> dict:
        tensor = self._to_tensor(frame_bgr)

        # TANet aesthetic score
        result = self._predict_tanet(tensor)

        # SAMP-Net composition score
        if self.samp_model is not None:
            samp_result = self._predict_samp(tensor, frame_bgr)
            result.update(samp_result)

        # Composition type classification
        if self.comp_classifier is not None:
            comp_type_result = self._predict_composition_type(tensor)
            result.update(comp_type_result)

        return result

    @torch.no_grad()
    def predict_batch(self, frames_bgr: list[np.ndarray]) -> list[dict]:
        """Score multiple images. TANet runs as a single batch; SAMP-Net loops per image."""
        if not frames_bgr:
            return []

        # Build batch tensor for TANet
        tensors = [self._to_tensor(f) for f in frames_bgr]
        batch = torch.cat(tensors, dim=0)  # [N, 3, 224, 224]

        # TANet batch forward pass
        tanet_scores = self.tanet(batch)  # [N, 1] or [N]
        results: list[dict] = []
        for i, s in enumerate(tanet_scores):
            score = round(float(s.item()) * 100, 1)
            results.append({'aesthetic_score': score, 'score': score})

        # SAMP-Net per-image (needs individual saliency maps)
        if self.samp_model is not None:
            for i, frame in enumerate(frames_bgr):
                samp_result = self._predict_samp(tensors[i], frame)
                results[i].update(samp_result)

        # Composition type classification (batch)
        if self.comp_classifier is not None:
            logits = self.comp_classifier(batch)  # [N, num_classes]
            probs = F.softmax(logits, dim=1)
            indices = probs.argmax(dim=1)
            for i, idx in enumerate(indices):
                raw_class = self.comp_types[int(idx.item())]
                results[i]['composition_type'] = COMP_CLASS_TO_OVERLAY.get(raw_class)

        return results
