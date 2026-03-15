"""Gemini-based composition visualization."""

from __future__ import annotations

import io
import json
import os
import re

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


INTERACTIVE_ANALYSIS_PROMPT = """Analyze the composition of this photograph and return a JSON object with the following structure. All coordinates must be normalized to 0-1 range (0,0 = top-left, 1,1 = bottom-right).

{
  "focal_points": [
    {"x": 0.0, "y": 0.0, "label": "short label", "importance": "primary|secondary"}
  ],
  "leading_lines": [
    {"points": [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 1.0}], "label": "short description"}
  ],
  "regions": [
    {"x": 0.0, "y": 0.0, "width": 0.0, "height": 0.0, "label": "short label", "description": "what this region contributes"}
  ],
  "grid_type": "rule_of_thirds|golden_ratio|center|diagonal",
  "eye_path": [
    {"x": 0.0, "y": 0.0}
  ],
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["tip 1", "tip 2"],
  "summary": "One or two sentence overall composition analysis"
}

Rules:
- Return ONLY valid JSON, no markdown, no code fences, no extra text
- focal_points: 2-5 key points where the eye is drawn. Mark the most important as "primary"
- leading_lines: 1-4 lines that guide the viewer's eye. Each line has 2-6 coordinate points describing the path
- regions: 1-3 important compositional regions (subject, foreground, background, negative space)
- eye_path: 4-8 points showing how the viewer's eye naturally travels through the image
- strengths: 2-3 things the composition does well
- improvements: 1-2 actionable suggestions to improve the shot
- summary: concise, specific to this image"""


def analyze_interactive(
    image_bytes: bytes,
    composition_type: str,
    scores: dict | None = None,
) -> dict | None:
    """Analyze an image and return structured JSON for interactive overlays.

    Args:
        image_bytes: JPEG image bytes
        composition_type: Dominant composition pattern name from SAMP-Net
        scores: Optional dict with aesthetic_score, composition_score, attributes

    Returns:
        Parsed dict with focal_points, leading_lines, regions, etc. or None.
    """
    api_key = _load_api_key()
    client = genai.Client(api_key=api_key)

    prompt = INTERACTIVE_ANALYSIS_PROMPT
    prompt += f'\n\nThe detected composition pattern is: {composition_type}.'

    if scores:
        aes = scores.get('aesthetic_score')
        comp = scores.get('composition_score')
        if aes is not None:
            prompt += f' Aesthetic score: {aes}/100.'
        if comp is not None:
            prompt += f' Composition score: {comp}/100.'
        attrs = scores.get('attributes', {})
        if attrs:
            strong = [name for name, val in attrs.items() if val > 0.3]
            if strong:
                prompt += f' Strong attributes: {", ".join(strong)}.'

    pil_image = Image.open(io.BytesIO(image_bytes))

    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=[prompt, pil_image],
    )

    # Extract text response and parse JSON
    text = ''
    for part in response.parts:
        if part.text:
            text += part.text

    if not text:
        return None

    # Strip markdown code fences if present
    text = text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"[Gemini] Failed to parse JSON: {text[:200]}")
        return None
