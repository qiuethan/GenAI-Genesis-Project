"""Gemini-based composition classification and visualization."""

from __future__ import annotations

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
    key = os.environ.get('GEMINI_API_KEY', '')
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set. Add it to server/.env or set as environment variable.")
    return key


# Only composition types that have drawable overlays
ALLOWED_TYPES = {
    'rule_of_thirds', 'symmetry', 'leading_lines', 'diagonals',
    'triangles', 'golden_ratio', 'negative_space', 'foreground_interest',
    'layering', 'patterns', 'framing',
}

CLASSIFY_PROMPT = (
    "Look at this photograph and identify which composition technique is most dominant. "
    "Reply with ONLY one of these exact labels, nothing else:\n"
    "rule_of_thirds, symmetry, leading_lines, diagonals, triangles, golden_ratio, "
    "negative_space, foreground_interest, layering, patterns, framing"
)

ANALYZE_PROMPT = (
    "Analyze the composition of this photograph. Identify which of these composition "
    "techniques are present:\n"
    "1. Rule of Thirds\n2. Symmetry\n3. Leading Lines\n4. Diagonals\n"
    "5. Triangles\n6. Golden Ratio/Spiral\n7. Negative Space\n"
    "8. Foreground Interest\n9. Layering (foreground/midground/background)\n"
    "10. Patterns or Repetition\n11. Framing (natural frame within the image)\n\n"
    "For each technique you identify, draw thin semi-transparent yellow guide lines, "
    "shapes, or annotations directly on the photo to show where and how that technique "
    "appears. For example:\n"
    "- For leading lines: trace the lines that guide the eye\n"
    "- For rule of thirds: show the grid and mark where subjects sit on intersections\n"
    "- For triangles: outline the triangle formed by elements\n"
    "- For symmetry: draw the axis of symmetry\n"
    "- For vanishing points: draw converging lines to the vanishing point\n\n"
    "Label each annotation with the technique name in small text. Only annotate "
    "techniques that are clearly present — do not force techniques that aren't there. "
    "Keep the original photo clearly visible underneath."
)


def classify_composition(image_bytes: bytes) -> str | None:
    """Classify the dominant composition technique using Gemini text model.

    Returns one of the ALLOWED_TYPES labels, or None if classification fails.
    Uses gemini-2.5-flash-lite for fast (~450ms) text-only classification.
    Retries once if response is not a valid label.
    """
    api_key = _load_api_key()
    client = genai.Client(api_key=api_key)
    pil_image = Image.open(io.BytesIO(image_bytes))

    # First attempt
    response = client.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=[CLASSIFY_PROMPT, pil_image],
    )
    result = (response.text or '').strip().lower().replace(' ', '_')

    if result in ALLOWED_TYPES:
        return result

    # Retry with error feedback
    retry_prompt = (
        f"Your response '{result}' is not one of the allowed labels. "
        f"You MUST respond with exactly one of: "
        f"{', '.join(sorted(ALLOWED_TYPES))}. Try again."
    )
    response = client.models.generate_content(
        model='gemini-2.5-flash-lite',
        contents=[CLASSIFY_PROMPT, pil_image, retry_prompt],
    )
    result = (response.text or '').strip().lower().replace(' ', '_')

    if result in ALLOWED_TYPES:
        return result

    return None


def analyze_composition_with_gemini(image_bytes: bytes) -> bytes | None:
    """Send an image to Gemini for full composition visualization with drawn lines.

    Uses gemini-3.1-flash-image-preview for image editing (~10-17s).
    Returns annotated image as bytes, or None if failed.
    """
    api_key = _load_api_key()
    client = genai.Client(api_key=api_key)
    pil_image = Image.open(io.BytesIO(image_bytes))

    response = client.models.generate_content(
        model='gemini-3.1-flash-image-preview',
        contents=[ANALYZE_PROMPT, pil_image],
    )

    for part in response.parts:
        if part.inline_data is not None:
            return part.inline_data.data

    return None
