"""Gemini image editing for composition visualization."""

from __future__ import annotations

import base64
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
        model='gemini-3.1-flash-image-preview',
        contents=[prompt, pil_image],
    )

    # Extract annotated image from response
    for part in response.parts:
        if part.inline_data is not None:
            # inline_data contains the raw image bytes directly
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
