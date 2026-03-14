"""Gemini image editing for composition visualization."""

from __future__ import annotations

import base64
import io
import os

from google import genai
from PIL import Image


def _load_api_key() -> str:
    """Load Gemini API key from server/.env file."""
    env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('GEMINI_API_KEY=') and not line.endswith('='):
                    return line.split('=', 1)[1].strip()
    # Fall back to environment variable
    key = os.environ.get('GEMINI_API_KEY', '')
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set. Add it to server/.env or set as environment variable.")
    return key


COMPOSITION_PROMPTS = {
    'Horizontal': 'Draw subtle composition guide lines on this photograph highlighting the horizontal division. Show the horizon line or horizontal balance axis. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Vertical': 'Draw subtle composition guide lines on this photograph highlighting the vertical division and any columnar structures. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Upper Triangle': 'Draw subtle composition guide lines on this photograph showing the triangular composition pattern. Highlight the triangular structure formed by the visual elements converging toward the top. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Lower Triangle': 'Draw subtle composition guide lines on this photograph showing the triangular composition pattern. Highlight the triangular structure formed by visual elements converging toward the bottom. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Center/Surround': 'Draw subtle composition guide lines on this photograph showing the center-surround composition. Highlight the central subject area and how the surrounding elements frame it. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Quadrants': 'Draw subtle composition guide lines on this photograph showing how the image is divided into quadrants with visual balance across the four sections. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Diagonal Cross': 'Draw subtle composition guide lines on this photograph highlighting the diagonal composition. Show the diagonal leading lines and any X-pattern or dynamic angular structures. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
    'Rule of Thirds': 'Draw subtle composition guide lines on this photograph showing the rule of thirds grid. Highlight where key subjects fall on the intersection points and along the grid lines. Use thin semi-transparent yellow lines. Keep the original image clearly visible.',
}

# Generic fallback that also asks for curves, vanishing points, leading lines
GENERIC_SUFFIX = ' Also highlight any leading lines, vanishing points, or curved lines that contribute to the composition.'


def analyze_composition_with_gemini(
    image_bytes: bytes,
    composition_type: str,
    attributes: dict[str, float] | None = None,
) -> bytes | None:
    """Send an image to Gemini for composition visualization.

    Args:
        image_bytes: JPEG image bytes
        composition_type: Dominant composition pattern name
        attributes: Optional attribute scores for richer prompts

    Returns:
        Annotated image as JPEG bytes, or None if failed.
    """
    api_key = _load_api_key()
    client = genai.Client(api_key=api_key)

    # Build prompt
    base_prompt = COMPOSITION_PROMPTS.get(composition_type, COMPOSITION_PROMPTS['Rule of Thirds'])
    prompt = base_prompt + GENERIC_SUFFIX

    # Add attribute context if available
    if attributes:
        strong = [name for name, val in attributes.items() if val > 0.3]
        if strong:
            prompt += f' Key composition strengths: {", ".join(strong)}.'

    # Load image
    pil_image = Image.open(io.BytesIO(image_bytes))

    # Call Gemini
    response = client.models.generate_content(
        model='gemini-2.0-flash-exp',
        contents=[prompt, pil_image],
    )

    # Extract annotated image from response
    for part in response.parts:
        if part.inline_data is not None:
            result_image = part.as_image()
            buf = io.BytesIO()
            result_image.save(buf, format='JPEG', quality=90)
            return buf.getvalue()

    return None
