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
    "You are a photography composition coach. Analyze this photo and annotate "
    "3-5 key points — things that make the composition work OR specific areas "
    "that could be improved.\n\n"
    "For each point, draw a single thin semi-transparent yellow line, arrow, or "
    "small circle directly on the photo with a short label (2-4 words).\n\n"
    "Examples of good annotations:\n"
    "- A line showing where the subject sits on a thirds intersection\n"
    "- An arrow showing where the eye enters the frame\n"
    "- A circle on a distracting element with 'crop here'\n"
    "- A line showing a strong diagonal the subject creates\n\n"
    "Rules:\n"
    "- MAXIMUM 5 annotations total. Fewer is better.\n"
    "- Each annotation is ONE line, arrow, or circle — not a full grid.\n"
    "- Mix strengths and improvements so the photographer learns.\n"
    "- Keep the original photo clearly visible. Minimal, clean overlays only."
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


INTERACTIVE_ANALYSIS_PROMPT = """You are an expert photography composition coach. Analyze this photograph and return a JSON object.

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
  "eye_path": [{"x": 0.0, "y": 0.0}],
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["tip 1", "tip 2"],
  "summary": "One or two sentence overall composition analysis"
}

Rules:
- Return ONLY valid JSON, no markdown, no code fences, no extra text
- All coordinates normalized 0-1 (0,0 = top-left, 1,1 = bottom-right)
- focal_points: 2-5 key points where the eye is drawn
- leading_lines: 1-4 lines guiding the eye, 2-6 points each
- regions: 1-3 important areas (subject, foreground, negative space)
- eye_path: 4-8 points showing natural eye movement
- strengths: 2-3 specific things done well (be precise, reference actual elements)
- improvements: 1-2 actionable tips the photographer can apply next time (e.g. "step two feet left to place the tree on the left third line", not generic advice)
- summary: concise, specific to THIS image — mention the subject, mood, and dominant technique"""


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

    # Add model context so Gemini can give targeted feedback
    context_parts = [f'\n\nContext from our scoring models:']
    context_parts.append(f'Dominant composition pattern: {composition_type}.')

    if scores:
        aes = scores.get('aesthetic_score')
        comp = scores.get('composition_score')
        if aes is not None:
            prompt_quality = 'poor' if aes < 40 else 'below average' if aes < 45 else 'average' if aes < 50 else 'good' if aes < 55 else 'excellent'
            context_parts.append(f'Aesthetic score: {aes}/100 ({prompt_quality}).')
        if comp is not None:
            context_parts.append(f'Composition score: {comp}/100.')

        # Distribution across 5 quality levels
        dist = scores.get('distribution')
        if dist:
            level_names = ['poor', 'below avg', 'average', 'good', 'excellent']
            dist_str = ', '.join(f'{level_names[i]}={d:.1%}' for i, d in enumerate(dist))
            context_parts.append(f'Quality distribution: [{dist_str}].')

        attrs = scores.get('attributes', {})
        if attrs:
            strong = [name for name, val in attrs.items() if val > 0.3]
            weak = [name for name, val in attrs.items() if val < 0.15]
            if strong:
                context_parts.append(f'Strong attributes: {", ".join(strong)}.')
            if weak:
                context_parts.append(f'Weak attributes: {", ".join(weak)} — consider addressing these in improvements.')

    prompt += ' '.join(context_parts)

    pil_image = Image.open(io.BytesIO(image_bytes))

    response = client.models.generate_content(
        model='gemini-2.5-flash',
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
