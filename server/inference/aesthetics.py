"""NIMA aesthetic scoring + fast numpy quality metrics."""

from __future__ import annotations

import cv2
import numpy as np
import torch
import torchvision.transforms as T

from ..model.nima import NIMA


IMAGE_NET_MEAN = [0.485, 0.456, 0.406]
IMAGE_NET_STD = [0.229, 0.224, 0.225]


class AestheticScorer:
    """NIMA aesthetic score + lightweight quality metrics."""

    def __init__(self, checkpoint_path: str, device: str = 'mps'):
        self.device = torch.device(device)

        self.model = NIMA(backbone='vgg16', num_classes=10)
        NIMA.load_pyiqa_weights(self.model, checkpoint_path)
        self.model.to(self.device).eval()

        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(mean=IMAGE_NET_MEAN, std=IMAGE_NET_STD),
        ])
        self._scores = torch.arange(1, 11, dtype=torch.float32, device=self.device)

        # Warmup
        dummy = torch.randn(1, 3, 224, 224, device=self.device)
        with torch.no_grad():
            self.model(dummy)
        print("[Aesthetic] NIMA VGG16 loaded and warmed up")

    @torch.no_grad()
    def score(self, frame_bgr: np.ndarray) -> dict:
        """Score a BGR frame. Returns aesthetic + quality metrics + coaching tip."""
        # --- NIMA aesthetic score (~20ms) ---
        rgb = frame_bgr[:, :, ::-1].copy()
        tensor = self.transform(rgb).unsqueeze(0).to(self.device)
        dist = self.model(tensor)[0]
        aesthetic_mean = float((dist * self._scores).sum().item())
        aesthetic_std = float(((dist * (self._scores - aesthetic_mean) ** 2).sum()).sqrt().item())

        # --- Fast numpy metrics (<2ms total) ---
        gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        gray_f = gray.astype(np.float32)

        # Exposure
        mean_brightness = float(gray_f.mean())
        pct_highlights = float((gray_f > 245).sum() / gray_f.size * 100)
        pct_shadows = float((gray_f < 10).sum() / gray_f.size * 100)

        # Sharpness (Laplacian variance)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Colorfulness (Hasler & Susstrunk 2003)
        B, G, R = frame_bgr[:, :, 0].astype(float), frame_bgr[:, :, 1].astype(float), frame_bgr[:, :, 2].astype(float)
        rg = R - G
        yb = 0.5 * (R + G) - B
        colorfulness = float(np.sqrt(rg.std() ** 2 + yb.std() ** 2) + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))

        # Color cast (LAB a/b deviation from neutral)
        lab = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2LAB).astype(float)
        a_mean = float(lab[:, :, 1].mean() - 128)  # center around 0
        b_mean = float(lab[:, :, 2].mean() - 128)
        color_cast = float(np.sqrt(a_mean ** 2 + b_mean ** 2))

        # --- Coaching tip ---
        tip = self._get_coaching_tip(
            aesthetic_mean, mean_brightness, pct_highlights, pct_shadows,
            sharpness, colorfulness, color_cast,
        )

        return {
            'aesthetic': round(aesthetic_mean, 2),
            'aesthetic_std': round(aesthetic_std, 2),
            'brightness': round(mean_brightness, 1),
            'highlights_pct': round(pct_highlights, 1),
            'shadows_pct': round(pct_shadows, 1),
            'sharpness': round(sharpness, 1),
            'colorfulness': round(colorfulness, 1),
            'color_cast': round(color_cast, 1),
            'tip': tip,
        }

    def _get_coaching_tip(self, aesthetic, brightness, highlights, shadows,
                          sharpness, colorfulness, color_cast) -> str | None:
        """Return the single most impactful coaching tip, or None if all is well."""
        issues = []

        # Priority order: technical problems first, then aesthetic
        if sharpness < 30:
            issues.append((0, "Hold steady — image is blurry"))
        if highlights > 5:
            issues.append((1, "Too bright — tap a darker area"))
        if shadows > 15:
            issues.append((2, "Too dark — find more light"))
        if brightness < 40:
            issues.append((3, "Scene is very dark"))
        if brightness > 210:
            issues.append((3, "Scene is very bright"))
        if colorfulness < 15:
            issues.append((4, "Scene looks dull — look for color"))
        if color_cast > 20:
            issues.append((5, "Lighting has a color cast"))

        if issues:
            issues.sort(key=lambda x: x[0])
            return issues[0][1]
        return None
