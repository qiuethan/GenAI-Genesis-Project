"""Display overlay compositing."""

from __future__ import annotations

import cv2
import numpy as np


def score_to_color(score: float) -> tuple[int, int, int]:
    """Map score 1-5 to BGR color (red -> yellow -> green)."""
    t = max(0.0, min(1.0, (score - 1.0) / 4.0))
    if t < 0.5:
        r = 255
        g = int(255 * (t * 2))
    else:
        r = int(255 * (2 - t * 2))
        g = 255
    return (0, g, r)  # BGR


def draw_rule_of_thirds(frame: np.ndarray) -> np.ndarray:
    """Draw rule-of-thirds grid lines."""
    h, w = frame.shape[:2]
    color = (255, 255, 255)
    thickness = 1
    alpha = 0.3
    overlay = frame.copy()
    for i in range(1, 3):
        y = h * i // 3
        cv2.line(overlay, (0, y), (w, y), color, thickness)
        x = w * i // 3
        cv2.line(overlay, (x, 0), (x, h), color, thickness)
    return cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)


def draw_histogram(frame: np.ndarray, distribution: list[float],
                   x: int, y: int, width: int = 120, height: int = 40):
    """Draw mini histogram of the 5-level distribution."""
    if not distribution:
        return
    max_val = max(distribution) if max(distribution) > 0 else 1.0
    bar_w = width // 5
    for i, val in enumerate(distribution):
        bar_h = int((val / max_val) * height)
        bx = x + i * bar_w
        by = y + height - bar_h
        # Color gradient from red to green
        t = i / 4.0
        color = (0, int(255 * t), int(255 * (1 - t)))
        cv2.rectangle(frame, (bx + 1, by), (bx + bar_w - 1, y + height), color, -1)
    # Labels
    for i in range(5):
        lx = x + i * bar_w + bar_w // 2 - 3
        cv2.putText(frame, str(i + 1), (lx, y + height + 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.3, (200, 200, 200), 1)


def draw_overlay(frame: np.ndarray, result: dict | None,
                 show_grid: bool, display_fps: float, inference_fps: float) -> np.ndarray:
    """Composite the full overlay onto the frame."""
    h, w = frame.shape[:2]
    out = frame.copy()

    if show_grid:
        out = draw_rule_of_thirds(out)

    # Bottom bar
    bar_height = 70
    overlay = out.copy()
    cv2.rectangle(overlay, (0, h - bar_height), (w, h), (0, 0, 0), -1)
    out = cv2.addWeighted(overlay, 0.6, out, 0.4, 0)

    bar_y = h - bar_height

    if result is not None:
        score = result.get('aesthetic_score', result.get('score', 0))
        label = result['label']
        dist = result['distribution']
        color = score_to_color(score)

        # Score text
        score_text = f"{score:.2f}"
        cv2.putText(out, score_text, (15, bar_y + 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, color, 2)

        # Quality label
        cv2.putText(out, label, (15, bar_y + 58),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 1)

        # Score bar (visual indicator)
        bar_x = 130
        bar_w_total = 150
        bar_fill = int(bar_w_total * (score - 1.0) / 4.0)
        cv2.rectangle(out, (bar_x, bar_y + 18), (bar_x + bar_w_total, bar_y + 38),
                      (80, 80, 80), -1)
        cv2.rectangle(out, (bar_x, bar_y + 18), (bar_x + bar_fill, bar_y + 38),
                      color, -1)
        cv2.rectangle(out, (bar_x, bar_y + 18), (bar_x + bar_w_total, bar_y + 38),
                      (150, 150, 150), 1)

        # Histogram
        draw_histogram(out, dist, x=300, y=bar_y + 8, width=120, height=40)

    # FPS counters
    fps_x = w - 180
    cv2.putText(out, f"Display: {display_fps:.0f} fps", (fps_x, bar_y + 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)
    cv2.putText(out, f"Inference: {inference_fps:.1f} fps", (fps_x, bar_y + 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 180), 1)

    # Controls hint
    cv2.putText(out, "Q:quit  G:grid  S:screenshot", (10, 18),
                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)

    return out
