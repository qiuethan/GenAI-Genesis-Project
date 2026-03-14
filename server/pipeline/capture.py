"""Webcam capture thread with optional auto-exposure."""

import threading
import time

import cv2

from .auto_exposure import AutoExposureController


class CaptureThread:
    """Grabs frames from webcam in a background thread.

    When *auto_exposure* is True (the default), each frame is analysed and
    exposure-corrected in software, similar to how Apple's camera ISP
    continuously adjusts brightness.  Hardware exposure control is attempted
    first; if the camera rejects it the correction is applied in software.
    """

    def __init__(
        self,
        camera_id: int = 0,
        width: int = 640,
        height: int = 480,
        auto_exposure: bool = True,
        ae_metering: str = "center-weighted",
        ae_target: float = 118.0,
        ae_speed: float = 0.1,
    ):
        self.cap = cv2.VideoCapture(camera_id)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open camera {camera_id}")

        self._frame = None
        self._lock = threading.Lock()
        self._running = False
        self._thread = None

        # Auto-exposure
        self._ae_enabled = auto_exposure
        self._ae: AutoExposureController | None = None
        self._hw_ae_supported: bool | None = None  # probed on first frame
        if auto_exposure:
            self._ae = AutoExposureController(
                target_brightness=ae_target,
                speed=ae_speed,
                metering_mode=ae_metering,
            )
            # Try to disable the camera's built-in AE so we can control it
            self.cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)

    def start(self):
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self):
        while self._running:
            ret, frame = self.cap.read()
            if ret:
                if self._ae is not None:
                    frame = self._apply_ae(frame)
                with self._lock:
                    self._frame = frame
            else:
                time.sleep(0.001)

    def _apply_ae(self, frame):
        """Run auto-exposure analysis and apply correction."""
        self._ae.analyze(frame)

        # On the first frame, probe whether the camera accepts hw control
        if self._hw_ae_supported is None:
            self._hw_ae_supported = self._ae.try_hardware_control(self.cap)

        if self._hw_ae_supported:
            self._ae.try_hardware_control(self.cap)
        else:
            frame = self._ae.correct(frame)
        return frame

    def get_frame(self):
        """Get the latest frame (may be None if not yet captured)."""
        with self._lock:
            return self._frame.copy() if self._frame is not None else None

    @property
    def ae_info(self) -> dict | None:
        """Return latest auto-exposure diagnostics, or None if AE is off."""
        if self._ae is None:
            return None
        return {
            "compensation": self._ae.compensation,
            "hw_control": self._hw_ae_supported,
        }

    def stop(self):
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        self.cap.release()
