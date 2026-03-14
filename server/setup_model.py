"""Download SAMP-Net pretrained weights from Dropbox."""

import os
import sys
import urllib.request

MODEL_URL = "https://www.dropbox.com/scl/fi/k1yuyhotuk9ky3m41iobg/samp_net.pth?rlkey=aoqqxv27wd5qqj3pytxki6vi3&st=0ffubx5d&dl=1"
MODEL_DIR = os.path.join(os.path.dirname(__file__), "pretrained_model")
MODEL_PATH = os.path.join(MODEL_DIR, "samp_net.pth")


def download_model(force: bool = False):
    if os.path.exists(MODEL_PATH) and not force:
        size_mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        print(f"Model already exists: {MODEL_PATH} ({size_mb:.1f} MB)")
        return MODEL_PATH

    os.makedirs(MODEL_DIR, exist_ok=True)
    print(f"Downloading SAMP-Net weights (~180 MB)...")
    print(f"  From: Dropbox")
    print(f"  To:   {MODEL_PATH}")

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

    try:
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH, reporthook=_progress)
        print()
        size_mb = os.path.getsize(MODEL_PATH) / (1024 * 1024)
        print(f"Download complete: {size_mb:.1f} MB")
        return MODEL_PATH
    except Exception as e:
        if os.path.exists(MODEL_PATH):
            os.remove(MODEL_PATH)
        raise RuntimeError(f"Download failed: {e}") from e


if __name__ == "__main__":
    force = "--force" in sys.argv
    path = download_model(force=force)
    print(f"Model ready at: {path}")
