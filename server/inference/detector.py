"""YOLO11n object detection for scan mode."""

from __future__ import annotations

import numpy as np
from ultralytics import YOLO


class ObjectDetector:
    """Lightweight YOLO11n detector for object selection and tracking."""

    def __init__(self, device: str = 'mps', conf_threshold: float = 0.3):
        self.device = device
        self.conf_threshold = conf_threshold
        self.model = YOLO('yolo11n.pt')
        # Warmup
        dummy = np.random.randint(0, 255, (224, 224, 3), dtype=np.uint8)
        self.model(dummy, device=self.device, verbose=False)
        print(f"[Detector] YOLO11n loaded on {self.device}")

    def detect(self, frame_bgr: np.ndarray) -> list[dict]:
        """Detect objects in a BGR frame.

        Returns list of dicts with keys:
            label: str (COCO class name)
            confidence: float
            box: [x1, y1, x2, y2] in pixels
            box_norm: [x1, y1, x2, y2] normalized 0-1
        """
        h, w = frame_bgr.shape[:2]
        results = self.model(frame_bgr, device=self.device, verbose=False)
        r = results[0]

        objects = []
        for box in r.boxes:
            conf = float(box.conf[0])
            if conf < self.conf_threshold:
                continue
            cls = int(box.cls[0])
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            objects.append({
                'label': self.model.names[cls],
                'confidence': round(conf, 3),
                'box': [round(x1), round(y1), round(x2), round(y2)],
                'box_norm': [
                    round(x1 / w, 4), round(y1 / h, 4),
                    round(x2 / w, 4), round(y2 / h, 4),
                ],
            })
        return objects

    def find_object(self, frame_bgr: np.ndarray, target_label: str,
                    target_box_norm: list[float]) -> dict | None:
        """Find a specific object in a frame by label and approximate position.

        Returns the detection closest to target_box_norm with matching label,
        or None if not found.
        """
        objects = self.detect(frame_bgr)
        matching = [o for o in objects if o['label'] == target_label]
        if not matching:
            return None

        # Find the one closest to the target position (by center distance)
        tx = (target_box_norm[0] + target_box_norm[2]) / 2
        ty = (target_box_norm[1] + target_box_norm[3]) / 2

        best = None
        best_dist = float('inf')
        for o in matching:
            cx = (o['box_norm'][0] + o['box_norm'][2]) / 2
            cy = (o['box_norm'][1] + o['box_norm'][3]) / 2
            dist = (cx - tx) ** 2 + (cy - ty) ** 2
            if dist < best_dist:
                best_dist = dist
                best = o
        return best

    def check_objects_in_frame(self, frame_bgr: np.ndarray,
                                targets: list[dict],
                                margin: float = 0.02) -> dict:
        """Check if all target objects are fully within the frame.

        Args:
            frame_bgr: BGR image
            targets: list of {label, box_norm} dicts (the selected objects)
            margin: how close to the edge is "out of frame" (fraction)

        Returns dict with:
            all_found: bool
            found_objects: list of detected positions for each target
            missing: list of labels not found
        """
        found_objects = []
        missing = []

        for target in targets:
            match = self.find_object(frame_bgr, target['label'], target['box_norm'])
            if match is None:
                missing.append(target['label'])
                continue

            # Check if the object is within frame bounds (not cut off at edges)
            b = match['box_norm']
            if b[0] < margin or b[1] < margin or b[2] > (1 - margin) or b[3] > (1 - margin):
                missing.append(target['label'])
                continue

            found_objects.append(match)

        return {
            'all_found': len(missing) == 0,
            'found_objects': found_objects,
            'missing': missing,
        }
