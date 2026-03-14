"""Utility functions for Glaze image processing.

Adapted from EspacioLatente/Glaze – fixed decompilation artifacts.
"""

import os
import platform

import numpy as np
import psutil
import torch
from einops import rearrange
from PIL import Image, ExifTags
from torchvision.transforms import (
    CenterCrop,
    Compose,
    InterpolationMode,
    Normalize,
    Resize,
    ToTensor,
)


# ---------------------------------------------------------------------------
# Parameter helpers
# ---------------------------------------------------------------------------

def get_parameters(setting: int, opt_setting: str) -> dict:
    """Return optimisation hyper-parameters for a given intensity/render level."""
    assert 0 <= setting <= 100

    if setting <= 50:
        actual_eps = 0.025 + 0.025 * setting / 50
    else:
        actual_eps = 0.05 + 0.05 * (setting - 50) / 50

    max_change = actual_eps
    print(f"CUR EPS: {max_change:.4f}")

    if opt_setting == "0":
        tot_steps = 4
        n_runs = 1
        style_transfer_iter = 10
    elif opt_setting == "1":
        tot_steps = 25
        n_runs = 1
        style_transfer_iter = 10
    elif opt_setting == "2":
        tot_steps = 30
        n_runs = 2
        style_transfer_iter = 13
    elif opt_setting == "3":
        tot_steps = 50
        n_runs = 2
        style_transfer_iter = 17
    else:
        raise ValueError(f"Unknown opt_setting: {opt_setting}")

    total_memory = psutil.virtual_memory().total / 1_073_741_824  # bytes → GiB
    if total_memory > 10:
        style_transfer_iter = 20

    return {
        "max_change": max_change,
        "n_runs": n_runs,
        "tot_steps": tot_steps,
        "setting": setting,
        "opt_setting": opt_setting,
        "style_transfer_iter": style_transfer_iter,
    }


def check_clip_threshold(params: dict, avg_clip_diff: float | None) -> bool:
    if avg_clip_diff is None:
        return True
    if params["setting"] == "1" or avg_clip_diff < 0.003:
        return False
    return True


# ---------------------------------------------------------------------------
# Image I/O
# ---------------------------------------------------------------------------

MAX_RES = 5120


def load_img(path: str, proj_path: str) -> Image.Image | None:
    """Load an image, fix EXIF orientation, convert to RGB, cap resolution."""
    if not os.path.exists(path):
        return None
    try:
        img = Image.open(path)
    except Exception:
        return None

    try:
        info = img.getexif()
    except OSError:
        return None

    if info is not None:
        orientation_key = None
        for k in ExifTags.TAGS:
            if ExifTags.TAGS[k] == "Orientation":
                orientation_key = k
                break

        if orientation_key and orientation_key in info:
            orient = info[orientation_key]
            if orient == 3:
                img = img.rotate(180, expand=True)
            elif orient == 6:
                img = img.rotate(270, expand=True)
            elif orient == 8:
                img = img.rotate(90, expand=True)

    img = img.convert("RGB")
    img = reduce_quality(img)
    return img


def reduce_quality(cur_img: Image.Image) -> Image.Image:
    long_side = max(cur_img.size)
    if long_side > MAX_RES:
        cur_img.thumbnail((MAX_RES, MAX_RES), Image.LANCZOS)
    return cur_img


# ---------------------------------------------------------------------------
# Tensor ↔ Image conversions
# ---------------------------------------------------------------------------

def img2tensor(cur_img: Image.Image, device: str = "cpu") -> torch.Tensor:
    """PIL Image → float32 tensor in [-1, 1], shape (1, C, H, W)."""
    assert cur_img.size[0] != 1
    arr = np.array(cur_img)
    arr = (arr / 127.5 - 1).astype(np.float32)
    arr = rearrange(arr, "h w c -> c h w")
    return torch.tensor(arr).unsqueeze(0).to(device)


def tensor2img(cur_img: torch.Tensor) -> Image.Image:
    """Float tensor in [-1, 1] → PIL Image."""
    if len(cur_img.shape) == 3:
        cur_img = cur_img.unsqueeze(0)
    cur_img = torch.clamp((cur_img.detach() + 1) / 2, min=0, max=1)
    arr = 255 * rearrange(cur_img[0], "c h w -> h w c").cpu().numpy()
    return Image.fromarray(arr.astype(np.uint8))


# ---------------------------------------------------------------------------
# CLIP wrapper (for quality-check scoring)
# ---------------------------------------------------------------------------

def _convert_image_to_rgb(image):
    return image.convert("RGB")


class CLIP(torch.nn.Module):
    def __init__(self, device: str, proj_root: str):
        super().__init__()
        self.device = device
        self.model = torch.load(
            os.path.join(proj_root, "clip_model.p"),
            map_location=torch.device("cpu"),
        )
        self.model = self.model.to(device)
        if device == "cpu":
            self.model = self.model.to(torch.float32)
        self.preprocess = self._local_preprocess()

    def _local_preprocess(self):
        return Compose([
            Resize(224, interpolation=InterpolationMode.BICUBIC),
            CenterCrop(224),
            _convert_image_to_rgb,
            ToTensor(),
            Normalize(
                (0.48145466, 0.4578275, 0.40821073),
                (0.26862954, 0.26130258, 0.27577711),
            ),
        ])

    def forward(self, image: Image.Image, text: str) -> float:
        import clip

        assert isinstance(text, str)
        image_t = self.preprocess(image).unsqueeze(0).to(self.device)
        text_t = clip.tokenize([text]).to(self.device)
        with torch.no_grad():
            img_feat = self.model.encode_image(image_t)
            txt_feat = self.model.encode_text(text_t)
            img_feat /= img_feat.norm(dim=-1, keepdim=True)
            txt_feat /= txt_feat.norm(dim=-1, keepdim=True)
            similarity = txt_feat.cpu().numpy() @ img_feat.cpu().numpy().T
        return float(similarity[0][0])
