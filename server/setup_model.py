"""Download pretrained weights."""

import os
import sys
import urllib.request

MODEL_DIR = os.path.join(os.path.dirname(__file__), "pretrained_model")

# TANet (aesthetic quality)
TANET_PATH = os.path.join(MODEL_DIR, "tanet_tad66k.pth")
PLACES365_PATH = os.path.join(MODEL_DIR, "resnet18_places365.pth.tar")

# SAMP-Net (composition)
SAMP_URL = "https://www.dropbox.com/scl/fi/k1yuyhotuk9ky3m41iobg/samp_net.pth?rlkey=aoqqxv27wd5qqj3pytxki6vi3&st=0ffubx5d&dl=1"
SAMP_PATH = os.path.join(MODEL_DIR, "samp_net.pth")

# NIMA VGG16 (aesthetic) — from pyiqa on Hugging Face
NIMA_PATH = os.path.join(MODEL_DIR, "nima_vgg16_ava.pth")
MODEL_PATH = SAMP_PATH  # backward compat


def _progress(block_num, block_size, total_size):
    downloaded = block_num * block_size
    if total_size > 0:
        pct = min(100, downloaded * 100 / total_size)
        mb = downloaded / (1024 * 1024)
        total_mb = total_size / (1024 * 1024)
        sys.stdout.write(f"\r  [{pct:5.1f}%] {mb:.1f} / {total_mb:.1f} MB")
    else:
        mb = downloaded / (1024 * 1024)
        sys.stdout.write(f"\r  {mb:.1f} MB downloaded")
    sys.stdout.flush()


def _download(url, path, name, size_hint=""):
    if os.path.exists(path):
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"{name} already exists: {path} ({size_mb:.1f} MB)")
        return path
    os.makedirs(MODEL_DIR, exist_ok=True)
    print(f"Downloading {name} {size_hint}...")
    print(f"  To: {path}")
    try:
        urllib.request.urlretrieve(url, path, reporthook=_progress)
        print()
        size_mb = os.path.getsize(path) / (1024 * 1024)
        print(f"  Done: {size_mb:.1f} MB")
        return path
    except Exception as e:
        if os.path.exists(path):
            os.remove(path)
        raise RuntimeError(f"Download failed: {e}") from e


def download_samp(force=False):
    if force and os.path.exists(SAMP_PATH):
        os.remove(SAMP_PATH)
    return _download(SAMP_URL, SAMP_PATH, "SAMP-Net weights", "(~180 MB)")


def download_nima(force=False):
    if force and os.path.exists(NIMA_PATH):
        os.remove(NIMA_PATH)
    # Download from Hugging Face
    try:
        from huggingface_hub import hf_hub_download
        if os.path.exists(NIMA_PATH) and not force:
            size_mb = os.path.getsize(NIMA_PATH) / (1024 * 1024)
            print(f"NIMA weights already exist: {NIMA_PATH} ({size_mb:.1f} MB)")
            return NIMA_PATH
        print("Downloading NIMA VGG16 weights from Hugging Face (~59 MB)...")
        downloaded = hf_hub_download(
            repo_id="chaofengc/IQA-PyTorch-Weights",
            filename="NIMA_VGG16_ava-dc4e8265.pth",
            local_dir=MODEL_DIR,
        )
        # Move to our standard name
        if downloaded != NIMA_PATH:
            os.rename(downloaded, NIMA_PATH)
        size_mb = os.path.getsize(NIMA_PATH) / (1024 * 1024)
        print(f"  Done: {size_mb:.1f} MB")
        return NIMA_PATH
    except ImportError:
        # Fallback: direct URL from HF
        url = "https://huggingface.co/chaofengc/IQA-PyTorch-Weights/resolve/main/NIMA_VGG16_ava-dc4e8265.pth"
        return _download(url, NIMA_PATH, "NIMA VGG16 weights", "(~59 MB)")


def download_model(force=False):
    """Download all models. Backward compat."""
    download_samp(force)
    download_nima(force)
    return SAMP_PATH


if __name__ == "__main__":
    force = "--force" in sys.argv
    download_samp(force)
    download_nima(force)
    print("\nAll models ready.")
