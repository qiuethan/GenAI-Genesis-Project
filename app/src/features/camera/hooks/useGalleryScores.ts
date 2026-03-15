import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { getServerUrl } from '../../../infra/network/serverUrl';

export interface GalleryScore {
  aesthetic_score: number;
  score?: number; // backward compat alias
  label: string;
  composition_score?: number;
  composition_type?: string;
  combined_score: number;
}

const STORAGE_KEY = '@composition_scores';

let _scoreCache: Record<string, GalleryScore> = {};
let _cacheLoaded = false;
let _cacheLoadPromise: Promise<void> | null = null;

// Listener pattern for reactive updates
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach(fn => fn());
}

async function loadCache(): Promise<void> {
  if (_cacheLoaded) return;
  if (_cacheLoadPromise) return _cacheLoadPromise;
  _cacheLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        _scoreCache = JSON.parse(raw);
        // Recompute combined_score for all entries (normalization may have changed)
        for (const id in _scoreCache) {
          const s = _scoreCache[id];
          s.combined_score = computeCombined(s.aesthetic_score, s.composition_score);
        }
        saveCache();
      }
    } catch {}
    _cacheLoaded = true;
  })();
  return _cacheLoadPromise;
}

async function saveCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_scoreCache));
  } catch {}
}

export const scoreToColor = (score: number): string => {
  const t = Math.max(0, Math.min(1, score / 100));
  if (t < 0.25) return '#ff4444';
  if (t < 0.5) return '#ff9900';
  if (t < 0.75) return '#aacc00';
  return '#44cc44';
};

/**
 * Sigmoid normalization — spreads out the clustered middle range.
 *
 * TANet aesthetic scores cluster tightly: 90% fall in 36–58, mean ~45, stdev ~3.4.
 * SAMP-Net composition is similarly compressed (5-level softmax → 0-100).
 *
 * We use per-metric centers and steepness so a 1-point raw difference
 * becomes a meaningful gap in the normalized output.
 */
function normalizeAesthetic(raw: number): number {
  // center=45 (observed mean), k=0.25 (steep — 3.4 stdev range)
  const sig = 1 / (1 + Math.exp(-0.25 * (raw - 45)));
  return Math.max(0, Math.min(100, Math.round(sig * 100)));
}

function normalizeComposition(raw: number): number {
  // center=50 (midpoint of 0-100 mapped 5-level), k=0.12 (wider spread)
  const sig = 1 / (1 + Math.exp(-0.12 * (raw - 50)));
  return Math.max(0, Math.min(100, Math.round(sig * 100)));
}

/**
 * Combine aesthetic + composition into a single score.
 * Normalizes each metric independently first to put them on comparable
 * scales, then weights the stronger one 60/40.
 */
function computeCombined(aesthetic: number, composition?: number): number {
  const normA = normalizeAesthetic(aesthetic);
  if (composition == null) return normA;
  const normC = normalizeComposition(composition);
  const hi = Math.max(normA, normC);
  const lo = Math.min(normA, normC);
  return Math.round(0.7 * hi + 0.3 * lo);
}

/**
 * Cache a score directly (e.g. from scan mode where the server already scored it).
 */
export async function cacheScore(photoId: string, score: number, label: string = ''): Promise<void> {
  await loadCache();
  _scoreCache[photoId] = { aesthetic_score: score, score, label, combined_score: normalize(score) };
  await saveCache();
}

/**
 * Remove scores for deleted photos.
 */
export async function removeScores(photoIds: string[]): Promise<void> {
  await loadCache();
  let changed = false;
  for (const id of photoIds) {
    if (_scoreCache[id]) {
      delete _scoreCache[id];
      changed = true;
    }
  }
  if (changed) {
    await saveCache();
    notifyListeners();
  }
}

/**
 * Score a single photo by sending it to the composition server.
 * Pass force=true to re-score an already-scored photo.
 */
export async function scorePhoto(photoId: string, photoUri: string, force = false): Promise<GalleryScore | null> {
  await loadCache();
  if (!force && _scoreCache[photoId]) return _scoreCache[photoId];

  try {
    const processed = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 480 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
    );

    const blob = await fetch(processed.uri).then(r => r.blob());
    const response = await fetch(`${getServerUrl()}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    });

    if (!response.ok) return null;
    const data = await response.json();
    const aestheticScore = data.aesthetic_score ?? data.score;
    if (aestheticScore === undefined) return null;

    const compositionScore = data.composition_score;
    const result: GalleryScore = {
      aesthetic_score: aestheticScore,
      score: aestheticScore, // backward compat
      label: data.label,
      composition_score: compositionScore,
      composition_type: data.composition_type,
      combined_score: computeCombined(aestheticScore, compositionScore),
    };
    _scoreCache[photoId] = result;
    await saveCache();
    notifyListeners();
    return result;
  } catch {
    return null;
  }
}

/**
 * Batch-score multiple photos via /score-batch.
 * Skips already-cached IDs. Falls back to sequential scoring if batch endpoint unavailable.
 */
export async function scorePhotoBatch(
  photos: Array<{ id: string; uri: string }>
): Promise<void> {
  await loadCache();

  // Filter out already-cached
  const uncached = photos.filter(p => !_scoreCache[p.id]);
  if (uncached.length === 0) return;

  try {
    // Process images and build FormData
    const formData = new FormData();
    for (let i = 0; i < uncached.length; i++) {
      const processed = await ImageManipulator.manipulateAsync(
        uncached[i].uri,
        [{ resize: { width: 480 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
      );
      const response = await fetch(processed.uri);
      const blob = await response.blob();
      formData.append(`image_${i}`, blob, `image_${i}.jpg`);
    }

    const res = await fetch(`${getServerUrl()}/score-batch`, {
      method: 'POST',
      body: formData,
    });

    if (res.status === 404) {
      // Fallback: sequential scoring (old server without batch endpoint)
      await Promise.all(uncached.map(p => scorePhoto(p.id, p.uri)));
      return;
    }

    if (!res.ok) return;

    const data = await res.json();
    const results: Array<Record<string, any>> = data.results || [];

    for (let i = 0; i < results.length && i < uncached.length; i++) {
      const r = results[i];
      if (r.error) continue;
      const aestheticScore = r.aesthetic_score ?? r.score;
      if (aestheticScore === undefined) continue;

      const compScore = r.composition_score;
      _scoreCache[uncached[i].id] = {
        aesthetic_score: aestheticScore,
        score: aestheticScore,
        label: r.label,
        composition_score: compScore,
        composition_type: r.composition_type,
        combined_score: computeCombined(aestheticScore, compScore),
      };
    }

    await saveCache();
    notifyListeners();
  } catch {
    // Fallback to sequential
    await Promise.all(uncached.map(p => scorePhoto(p.id, p.uri)));
  }
}

/**
 * Hook that provides access to cached composition scores.
 * Auto-updates when scorePhoto() or scorePhotoBatch() completes.
 */
export const useGalleryScores = () => {
  const [scores, setScores] = useState<Record<string, GalleryScore>>(_scoreCache);

  useEffect(() => {
    loadCache().then(() => setScores({ ..._scoreCache }));

    const listener = () => setScores({ ..._scoreCache });
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const refresh = useCallback(() => {
    setScores({ ..._scoreCache });
  }, []);

  return { scores, refresh };
};
