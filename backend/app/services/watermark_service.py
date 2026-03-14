"""
Invisible watermark service using blind_watermark.

Embeds an invisible watermark (e.g. artist ID) into uploaded images
so that provenance can later be verified by extraction.
"""

import io
import os
import tempfile

from blind_watermark import WaterMark


# Shared passwords for watermark encoding/decoding.
# In production these should come from env vars.
_PWD_IMG = int(os.getenv("WM_PASSWORD_IMG", "1"))
_PWD_WM = int(os.getenv("WM_PASSWORD_WM", "1"))


def embed_watermark(image_bytes: bytes, watermark_text: str, file_ext: str = "png") -> tuple[bytes, int]:
    """
    Embed an invisible watermark into an image.

    Args:
        image_bytes: Raw image bytes.
        watermark_text: The string to embed (e.g. artist ID).
        file_ext: File extension for temp files.

    Returns:
        (watermarked_image_bytes, wm_length) — wm_length is needed for extraction.
    """
    with tempfile.TemporaryDirectory() as tmp:
        input_path = os.path.join(tmp, f"input.{file_ext}")
        output_path = os.path.join(tmp, f"output.{file_ext}")

        with open(input_path, "wb") as f:
            f.write(image_bytes)

        bwm = WaterMark(password_img=_PWD_IMG, password_wm=_PWD_WM)
        bwm.read_img(input_path)
        bwm.read_wm(watermark_text, mode="str")
        bwm.embed(output_path)
        wm_length = len(bwm.wm_bit)

        with open(output_path, "rb") as f:
            watermarked_bytes = f.read()

    return watermarked_bytes, wm_length


def extract_watermark(image_bytes: bytes, wm_length: int, file_ext: str = "png") -> str:
    """
    Extract the invisible watermark from a watermarked image.

    Args:
        image_bytes: Raw image bytes of the watermarked image.
        wm_length: The watermark bit length returned during embedding.
        file_ext: File extension for temp files.

    Returns:
        The extracted watermark string.
    """
    with tempfile.TemporaryDirectory() as tmp:
        input_path = os.path.join(tmp, f"input.{file_ext}")

        with open(input_path, "wb") as f:
            f.write(image_bytes)

        bwm = WaterMark(password_img=_PWD_IMG, password_wm=_PWD_WM)
        extracted = bwm.extract(input_path, wm_shape=wm_length, mode="str")

    return extracted
