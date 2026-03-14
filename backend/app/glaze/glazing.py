"""Main Glaze class – high-level API for image protection.

Adapted from EspacioLatente/Glaze – fixed decompilation artifacts,
removed PyQt5 dependency, added MPS (Apple Silicon) support.
"""

import os
import random
import time
from pathlib import Path
from typing import Callable

import torch

from app.glaze.glazeopt import GlazeOptimizer
from app.glaze.utils import get_parameters

PROD = True

PROJECT_ROOT_PATH = os.path.join(Path.home(), ".glaze")
os.makedirs(PROJECT_ROOT_PATH, exist_ok=True)

TARGET_LIST = ["impressionism painting by van gogh;0.55"]


class Glaze:
    """Protect artwork from AI style-mimicry via adversarial perturbation.

    Args:
        intensity: Protection intensity 0-100 (default 50).
        render_quality: Render quality "0" (preview) to "3" (max). Default "2".
        output_dir: Where to save glazed images.
        jpg: Whether to save as JPEG (0 or 1).
        progress_callback: Optional ``fn(msg: str)`` for progress updates.
    """

    def __init__(
        self,
        intensity: int = 50,
        render_quality: str = "2",
        output_dir: str | None = None,
        jpg: int = 0,
        progress_callback: Callable[[str], None] | None = None,
    ):
        self.params = get_parameters(intensity, render_quality)
        self.project_root_path = PROJECT_ROOT_PATH
        self.output_dir = output_dir
        self.progress_callback = progress_callback

        if output_dir is not None:
            os.makedirs(output_dir, exist_ok=True)

        self.device = self._detect_device()
        self.target_params = self._load_target_info()

        self.optimizer = GlazeOptimizer(
            params=self.params,
            device=self.device,
            target_params=self.target_params,
            project_root_path=self.project_root_path,
            jpg=jpg,
            progress_callback=progress_callback,
        )
        self.optimizer.output_dir = self.output_dir
        print(f"Glaze device: {self.device}")

    # ------------------------------------------------------------------
    # Device detection – CUDA → MPS → CPU
    # ------------------------------------------------------------------
    @staticmethod
    def _detect_device() -> str:
        if torch.cuda.is_available():
            mem_mb = torch.cuda.get_device_properties(0).total_memory / 1_048_576
            if 5000 < mem_mb < 30000:
                print("Run on cuda")
                return "cuda"
        if torch.backends.mps.is_available():
            print("Run on mps (Apple Silicon)")
            return "mps"
        print("Run on cpu")
        return "cpu"

    # ------------------------------------------------------------------
    # Target style info
    # ------------------------------------------------------------------
    def _load_target_info(self) -> dict:
        if not PROD:
            return {
                "style": "impressionism painting by van gogh",
                "strength": 0.55,
                "seed": 3242,
            }

        target_file = os.path.join(self.project_root_path, "target.txt")

        if os.path.exists(target_file):
            with open(target_file, "r") as f:
                data = f.read().split("\n")
                idx = int(data[0])
                seed = int(data[1])
        else:
            idx = random.choice(range(len(TARGET_LIST)))
            seed = random.randrange(1, 1000)
            with open(target_file, "w+") as f:
                f.write(f"{idx}\n{seed}")

        cur_target = TARGET_LIST[idx]
        cur_style, cur_strength = cur_target.split(";")
        cur_strength = float(cur_strength)

        if self.params["opt_setting"] == "0":
            actual_strength = 0.6
        else:
            actual_strength = self._cal_strength(cur_strength)

        return {"style": cur_style, "strength": actual_strength, "seed": seed}

    def _cal_strength(self, cur_strength: float) -> float:
        setting = self.params["setting"]
        if setting < 20:
            actual = cur_strength - 0.05
        elif setting < 40:
            actual = cur_strength - 0.01
        elif setting < 60:
            actual = cur_strength + 0.03
        else:
            actual = cur_strength + 0.08
        return min(actual, 0.6)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def run_protection(self, image_paths: list[str]) -> list[str]:
        """Glaze a list of images. Returns paths to the protected copies."""
        s = time.time()
        out_files, is_error = self.optimizer.generate(image_paths)
        print(f"Total time {time.time() - s:.2f}s")
        if is_error:
            raise RuntimeError(
                f"Glaze encountered errors for at least one image. "
                f"See error.txt in {self.output_dir} for details."
            )
        return out_files
