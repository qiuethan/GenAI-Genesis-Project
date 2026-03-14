"""Spectral residual saliency detector (CPU, ~1-2ms on 224x224)."""

from __future__ import annotations

import cv2
import numpy as np


def detect_saliency(img_bgr: np.ndarray, target_size: tuple[int, int] = (224, 224),
                    scale: int = 6, q_value: float = 0.95) -> np.ndarray:
    """Compute spectral residual saliency map.

    Args:
        img_bgr: BGR image (OpenCV format).
        target_size: Output saliency map size (W, H).
        scale: Downscale factor for FFT.
        q_value: Quantile for clamping.

    Returns:
        Normalized saliency map as float32 array of shape target_size.
    """
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    H, W = gray.shape
    small = cv2.resize(gray, (W // scale, H // scale), interpolation=cv2.INTER_AREA)

    fft = np.fft.fft2(small)
    phase = np.angle(fft)
    log_amp = np.log(np.abs(fft) + 1e-6)
    avg = cv2.blur(log_amp, (3, 3))
    spectral_residual = log_amp - avg

    recon = np.exp(spectral_residual) * (np.cos(phase) + 1j * np.sin(phase))
    sal = np.abs(np.fft.ifft2(recon)) ** 2
    sal = cv2.GaussianBlur(sal, (9, 9), 2.5)
    sal = cv2.resize(sal, target_size, interpolation=cv2.INTER_LINEAR)

    threshold = np.quantile(sal.ravel(), q_value)
    if threshold > 0:
        sal[sal > threshold] = threshold
        sal = (sal - sal.min()) / threshold

    return sal.astype(np.float32)
