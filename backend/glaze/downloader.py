"""Model downloader for Glaze.

Downloads required model weights from UChicago mirror and HuggingFace.
Adapted from EspacioLatente/Glaze – fixed decompilation artifacts.
"""

import hashlib
import os
import random
import zipfile
from pathlib import Path
from typing import Callable
from urllib.error import HTTPError, URLError
from urllib.request import urlretrieve

import shutil

PROJECTS_ROOT_PATH = os.path.join(Path.home(), ".glaze")
os.makedirs(PROJECTS_ROOT_PATH, exist_ok=True)

# (target_subdir, url, md5, label)
_RESOURCES = [
    (PROJECTS_ROOT_PATH, "http://mirror.cs.uchicago.edu/fawkes/files/glaze/base.zip",
     "0404aa8a44342abb4de336aafa4878e6", "1 / 9", True),
    (os.path.join(PROJECTS_ROOT_PATH, "base", "base", "unet"),
     "http://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/unet/diffusion_pytorch_model.bin",
     "f54896820e5730b03996ce8399c3123e", "2 / 9", False),
    (os.path.join(PROJECTS_ROOT_PATH, "base", "base", "text_encoder"),
     "http://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/text_encoder/pytorch_model.bin",
     "167df82281473d0f2a320aea8fab9059", "3 / 9", False),
    (os.path.join(PROJECTS_ROOT_PATH, "base", "base", "vae"),
     "http://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/vae/diffusion_pytorch_model.bin",
     "a90d1567d06336ea076afe50455c0712", "4 / 9", False),
    (PROJECTS_ROOT_PATH,
     "http://mirror.cs.uchicago.edu/fawkes/files/glaze/bpe_simple_vocab_16e6.txt.gz",
     "933b7abbbbde62c36f02f0e6ccde464f", "5 / 9", False),
    (PROJECTS_ROOT_PATH,
     "http://mirror.cs.uchicago.edu/fawkes/files/glaze/preview_mask.p",
     "120c5eb7a6e6928405e58e5fe34886d5", "6 / 9", False),
    (PROJECTS_ROOT_PATH,
     "http://mirror.cs.uchicago.edu/fawkes/files/glaze/glaze-qc.p",
     "0f3a00b66b463a908e442e2ba43ce464", "7 / 9", False),
    (PROJECTS_ROOT_PATH,
     "http://mirror.cs.uchicago.edu/fawkes/files/glaze/glaze.p",
     "869bd38b0079b4ede3f5fe4f0e19ae22", "8 / 9", False),
    (PROJECTS_ROOT_PATH,
     "http://mirror.cs.uchicago.edu/fawkes/files/glaze/clip_model.p",
     "41c6e336016333b6210b9840d1283d9f", "9 / 9", False),
]


def download_all_resources(
    progress_callback: Callable[[str], None] | None = None,
) -> None:
    """Download every model file Glaze needs (~5 GB total)."""
    for root_dir, url, md5, label, extract in _RESOURCES:
        get_file(
            root_dir=root_dir,
            origin=url,
            md5_hash=md5,
            file_num=label,
            extract=extract,
            progress_callback=progress_callback,
        )


def get_file(
    root_dir: str,
    origin: str,
    md5_hash: str | None = None,
    file_num: str | None = None,
    extract: bool = False,
    progress_callback: Callable[[str], None] | None = None,
) -> str:
    """Download a single file if it doesn't exist or fails hash check."""
    os.makedirs(root_dir, exist_ok=True)
    fname = origin.split("/")[-1]
    fpath = os.path.join(root_dir, fname)

    need_download = True
    if os.path.exists(fpath):
        if md5_hash is not None:
            need_download = not _validate_file(fpath, md5_hash)
        else:
            need_download = False

    if need_download:
        def _dl_progress(count, block_size, total_size):
            if progress_callback and random.uniform(0, 1) < 0.05:
                mb_done = count * block_size / 1024 / 1024
                mb_total = total_size / 1024 / 1024
                progress_callback(
                    f"Downloading resource {file_num} ({mb_done:.1f} / {mb_total:.1f} MB)"
                )

        try:
            urlretrieve(origin, fpath, _dl_progress)
        except (HTTPError, URLError) as e:
            if os.path.exists(fpath):
                os.remove(fpath)
            raise RuntimeError(f"Download failed for {origin}: {e}") from e

    if need_download and extract:
        _extract_archive(fpath)

    return fpath


def _extract_archive(file_path: str) -> None:
    """Extract a .zip archive alongside the archive file."""
    assert file_path.lower().endswith(".zip")
    tmp_dir = file_path.replace(".zip", "_tmp")
    out_dir = file_path.replace(".zip", "")

    with zipfile.ZipFile(file_path, "r") as zf:
        zf.extractall(tmp_dir)

    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    shutil.move(tmp_dir, out_dir)


def _validate_file(fpath: str, expected_md5: str, chunk_size: int = 65535) -> bool:
    hasher = hashlib.md5()
    with open(fpath, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            hasher.update(chunk)
    return hasher.hexdigest() == expected_md5
