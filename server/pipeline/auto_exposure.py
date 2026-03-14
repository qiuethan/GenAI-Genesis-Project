"""Software-based auto-exposure controller.

Analyzes frame luminance and applies exposure correction, similar to how
Apple's camera ISP continuously adjusts exposure. Supports center-weighted,
average, and spot metering modes with highlight protection.
"""

import cv2
import numpy as np


class AutoExposureController:
    """Measures scene brightness and computes exposure compensation.

    Works in two modes:
    - Hardware: adjusts camera exposure/gain via OpenCV properties (best on Linux)
    - Software: applies gain correction to captured frames (fallback, works everywhere)
    """

    def __init__(
        self,
        target_brightness: float = 118.0,
        speed: float = 0.1,
        metering_mode: str = "center-weighted",
        deadband: float = 3.0,
        highlight_threshold: int = 240,
        max_highlight_ratio: float = 0.03,
    ):
        """
        Args:
            target_brightness: Target mean luminance (0-255). 118 ≈ 18% gray in sRGB.
            speed: EMA smoothing factor (0-1). Higher = faster response.
            metering_mode: One of "center-weighted", "average", "spot".
            deadband: Ignore errors smaller than this to prevent micro-oscillation.
            highlight_threshold: Pixel value above which a pixel is "blown out".
            max_highlight_ratio: Max fraction of highlight pixels before forcing
                exposure reduction.
        """
        self.target = target_brightness
        self.speed = speed
        self.metering_mode = metering_mode
        self.deadband = deadband
        self.highlight_threshold = highlight_threshold
        self.max_highlight_ratio = max_highlight_ratio

        self._smoothed_lum: float = target_brightness
        self._compensation: float = 0.0  # EV-like units
        self._weight_mask: np.ndarray | None = None
        self._weight_mask_shape: tuple[int, int] = (0, 0)

    # ------------------------------------------------------------------
    # Metering weight masks
    # ------------------------------------------------------------------

    def _build_weight_mask(self, h: int, w: int) -> np.ndarray:
        if self.metering_mode == "center-weighted":
            Y, X = np.ogrid[:h, :w]
            cx, cy = w / 2.0, h / 2.0
            sigma = min(h, w) * 0.3
            mask = np.exp(-((X - cx) ** 2 + (Y - cy) ** 2) / (2 * sigma ** 2))
        elif self.metering_mode == "spot":
            mask = np.zeros((h, w), dtype=np.float32)
            r = int(min(h, w) * 0.05)
            cv2.circle(mask, (w // 2, h // 2), max(r, 1), 1.0, -1)
        else:  # "average"
            mask = np.ones((h, w), dtype=np.float32)

        total = mask.sum()
        if total > 0:
            mask /= total
        return mask.astype(np.float32)

    def _get_weights(self, h: int, w: int) -> np.ndarray:
        if self._weight_mask is None or self._weight_mask_shape != (h, w):
            self._weight_mask = self._build_weight_mask(h, w)
            self._weight_mask_shape = (h, w)
        return self._weight_mask

    # ------------------------------------------------------------------
    # Core analysis
    # ------------------------------------------------------------------

    def analyze(self, frame: np.ndarray) -> dict:
        """Analyze a frame and update internal exposure compensation.

        Returns a dict with diagnostic info:
            measured_luminance, smoothed_luminance, error,
            compensation, highlight_ratio
        """
        if frame.ndim == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        else:
            gray = frame
        h, w = gray.shape
        gray_f = gray.astype(np.float32)

        # Weighted luminance
        weights = self._get_weights(h, w)
        measured = float(np.sum(gray_f * weights))

        # Temporal smoothing (EMA)
        self._smoothed_lum += (measured - self._smoothed_lum) * self.speed
        error = self.target - self._smoothed_lum

        # Highlight protection: override error if too many blown pixels
        highlight_ratio = float(np.mean(gray > self.highlight_threshold))
        if highlight_ratio > self.max_highlight_ratio:
            error = min(error, -highlight_ratio * 300)

        # Deadband – don't adjust for tiny errors
        if abs(error) < self.deadband:
            correction = 0.0
        else:
            # Adaptive gain: converge faster when far from target
            if abs(error) > 40:
                kp = 0.020
            elif abs(error) > 15:
                kp = 0.010
            else:
                kp = 0.005
            correction = kp * error

        self._compensation = float(
            np.clip(self._compensation + correction, -5.0, 5.0)
        )

        return {
            "measured_luminance": measured,
            "smoothed_luminance": self._smoothed_lum,
            "error": error,
            "compensation": self._compensation,
            "highlight_ratio": highlight_ratio,
        }

    # ------------------------------------------------------------------
    # Applying the correction
    # ------------------------------------------------------------------

    def correct(self, frame: np.ndarray) -> np.ndarray:
        """Apply the current exposure compensation to *frame* in software."""
        gain = 2.0 ** self._compensation
        return cv2.convertScaleAbs(frame, alpha=gain, beta=0)

    def try_hardware_control(self, cap: cv2.VideoCapture) -> bool:
        """Attempt to push exposure compensation to the camera hardware.

        Returns True if the camera accepted the value.
        """
        exposure_val = float(np.clip(-6 + self._compensation, -13, 0))
        return bool(cap.set(cv2.CAP_PROP_EXPOSURE, exposure_val))

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    @property
    def compensation(self) -> float:
        """Current exposure compensation in EV-like units."""
        return self._compensation

    def reset(self) -> None:
        """Reset internal state."""
        self._smoothed_lum = self.target
        self._compensation = 0.0
