"""Service wrapper for Glaze image protection.

Provides a simple interface for the rest of the app to glaze images
without touching Glaze internals. Gracefully skips glazing when the
required models (~5 GB) are not yet downloaded.
"""

import logging
import os
import tempfile
from pathlib import Path

log = logging.getLogger(__name__)

# Required model files that must exist in ~/.glaze for glazing to work
_GLAZE_ROOT = os.path.join(Path.home(), ".glaze")
_REQUIRED_MODELS = ["glaze.p", "glaze-qc.p", "preview_mask.p"]


def models_available() -> bool:
    """Return True if the Glaze model weights are present locally."""
    return all(
        os.path.isfile(os.path.join(_GLAZE_ROOT, f)) for f in _REQUIRED_MODELS
    )


def ensure_models_downloaded(progress_callback=None) -> None:
    """Download Glaze model weights if they aren't cached yet (~5 GB)."""
    from app.glaze.downloader import download_all_resources

    download_all_resources(progress_callback=progress_callback)


def glaze_image(
    input_path: str,
    output_dir: str | None = None,
    intensity: int = 50,
    render_quality: str = "1",
    progress_callback=None,
) -> str:
    """Apply Glaze protection to a single image.

    Returns the path to the glazed image, or the original path if
    models are not available.
    """
    input_path = os.path.abspath(input_path)
    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Image not found: {input_path}")

    if not models_available():
        log.warning("Glaze models not downloaded — skipping image protection")
        return input_path

    from app.glaze.glazing import Glaze

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
    render_quality: str = "1",
    progress_callback=None,
) -> bytes:
    """Glaze an image provided as raw bytes; returns glazed image bytes.

    Returns the original bytes unchanged if models are not available.
    """
    if not models_available():
        log.warning("Glaze models not downloaded — returning original image")
        return image_bytes

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
