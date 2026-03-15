"""Re-score all submissions through the local ML server and update Supabase.

Usage (with the scoring server already running on port 8420):
    python scripts/rescore_submissions.py
    python scripts/rescore_submissions.py --dry-run    # preview without writing
    python scripts/rescore_submissions.py --user USER_ID  # single user only
"""

import argparse
import io
import json
import math
import os
import sys
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Config – read from .env or environment
# ---------------------------------------------------------------------------

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip())

load_env()

SUPABASE_URL = os.environ.get('SUPABASE_URL', '').rstrip('/')
SUPABASE_KEY = os.environ.get('SUPABASE_PUBLISHABLE_KEY', '')
SCORE_SERVER = 'http://localhost:8420'


def supabase_request(method, path, body=None):
    """Make a request to Supabase REST API."""
    url = f'{SUPABASE_URL}/rest/v1/{path}'
    data = json.dumps(body).encode() if body else None
    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def fetch_submissions(user_id=None):
    """Fetch all submissions from Supabase."""
    path = 'submissions?select=id,photo_url,score,score_metadata&order=submitted_at.asc'
    if user_id:
        path += f'&user_id=eq.{user_id}'
    return supabase_request('GET', path)


def download_image(url):
    """Download image bytes from a URL."""
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def score_image(jpeg_bytes):
    """Send image bytes to the local scoring server."""
    req = urllib.request.Request(
        f'{SCORE_SERVER}/score',
        data=jpeg_bytes,
        headers={'Content-Type': 'image/jpeg'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def normalize_aesthetic(raw):
    sig = 1 / (1 + math.exp(-0.25 * (raw - 45)))
    return max(0.0, min(1.0, sig))


def normalize_composition(raw):
    sig = 1 / (1 + math.exp(-0.12 * (raw - 50)))
    return max(0.0, min(1.0, sig))


def compute_combined(aesthetic, composition=None):
    norm_a = normalize_aesthetic(aesthetic)
    if composition is None:
        return norm_a
    norm_c = normalize_composition(composition)
    hi = max(norm_a, norm_c)
    lo = min(norm_a, norm_c)
    return 0.7 * hi + 0.3 * lo


def update_submission(submission_id, score, metadata):
    """Update a submission's score in Supabase."""
    path = f'submissions?id=eq.{submission_id}'
    body = {
        'score': score,
        'score_metadata': metadata,
    }
    return supabase_request('PATCH', path, body)


def main():
    parser = argparse.ArgumentParser(description='Re-score all submissions')
    parser.add_argument('--dry-run', action='store_true', help='Preview scores without updating Supabase')
    parser.add_argument('--user', type=str, default=None, help='Only re-score submissions for this user ID')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print('ERROR: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set in .env')
        sys.exit(1)

    # Check scoring server health
    try:
        req = urllib.request.Request(f'{SCORE_SERVER}/health')
        with urllib.request.urlopen(req, timeout=5) as resp:
            health = json.loads(resp.read())
            if not health.get('model_loaded'):
                print('ERROR: Scoring server models not loaded yet')
                sys.exit(1)
    except Exception as e:
        print(f'ERROR: Cannot reach scoring server at {SCORE_SERVER}: {e}')
        print('Make sure the server is running: python -m server.server')
        sys.exit(1)

    submissions = fetch_submissions(args.user)
    print(f'Found {len(submissions)} submissions to re-score\n')

    succeeded = 0
    failed = 0

    for i, sub in enumerate(submissions):
        sub_id = sub['id']
        photo_url = sub['photo_url']
        old_score = sub.get('score')

        print(f'[{i+1}/{len(submissions)}] {sub_id[:8]}...', end=' ')

        try:
            # Download the photo
            jpeg_bytes = download_image(photo_url)

            # Score it
            result = score_image(jpeg_bytes)

            aesthetic = result.get('aesthetic_score', result.get('score'))
            if aesthetic is None:
                print('SKIP (no aesthetic score returned)')
                failed += 1
                continue

            composition = result.get('composition_score')
            combined = compute_combined(aesthetic, composition)

            metadata = {
                'aesthetic_score': aesthetic,
                'composition_score': composition,
                'composition_type': result.get('composition_type'),
                'attributes': result.get('attributes', {}),
                'inference_ms': result.get('inference_ms'),
            }

            old_display = f'{old_score * 100:.0f}' if old_score is not None else 'none'
            new_display = f'{combined * 100:.0f}'
            comp_display = f'{composition:.1f}' if composition is not None else 'n/a'
            print(f'aesthetic={aesthetic:.1f} comp={comp_display} combined={new_display} (was {old_display})')

            if not args.dry_run:
                update_submission(sub_id, round(combined, 6), metadata)

            succeeded += 1

        except Exception as e:
            print(f'ERROR: {e}')
            failed += 1

    print(f'\nDone: {succeeded} scored, {failed} failed')
    if args.dry_run:
        print('(dry run — no changes written to Supabase)')


if __name__ == '__main__':
    main()
