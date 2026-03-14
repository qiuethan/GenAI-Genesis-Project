"""Service wrapper for Glaze image protection.

Provides a simple interface for the rest of the app to glaze images
without touching Glaze internals.
"""

import os
import tempfile
import shutil
from pathlib import Path

from PIL import Image


def ensure_models_downloaded(
    progress_callback=None,
) -> None:
    """Download Glaze model weights if they aren't cached yet (~5 GB)."""
    from app.glaze.downloader import download_all_resources

    download_all_resources(progress_callback=progress_callback)


def glaze_image(
    input_path: str,
    output_dir: str | None = None,
    intensity: int = 50,
    render_quality: str = "2",
    progress_callback=None,
) -> str:
    """Apply Glaze protection to a single image.

    Args:
        input_path: Path to the source image file.
        output_dir: Directory for the glazed output.  Defaults to a
            ``glazed/`` subdirectory next to the input file.
        intensity: Protection strength 0-100 (default 50).
        render_quality: "0" (preview/fast) … "3" (max quality).
        progress_callback: Optional ``fn(msg)`` for status updates.

    Returns:
        Absolute path to the glazed image file.
    """
    from app.glaze.glazing import Glaze

    input_path = os.path.abspath(input_path)
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Image not found: {input_path}")

    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(input_path), "glazed")
    os.makedirs(output_dir, exist_ok=True)

    protector = Glaze(
        intensity=intensity,
        render_quality=render_quality,
        output_dir=output_dir,
        progress_callback=progress_callback,
    )

    out_files = protector.run_protection([input_path])
    return out_files[0]


def glaze_image_bytes(
    image_bytes: bytes,
    filename: str = "artwork.png",
    intensity: int = 50,
    render_quality: str = "2",
    progress_callback=None,
) -> bytes:
    """Glaze an image provided as raw bytes; returns glazed image bytes.

    Useful for API endpoints that receive file uploads.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = os.path.join(tmpdir, filename)
        output_dir = os.path.join(tmpdir, "out")

        with open(input_path, "wb") as f:
            f.write(image_bytes)

        out_path = glaze_image(
            input_path=input_path,
            output_dir=output_dir,
            intensity=intensity,
            render_quality=render_quality,
            progress_callback=progress_callback,
        )

        with open(out_path, "rb") as f:
            return f.read()
