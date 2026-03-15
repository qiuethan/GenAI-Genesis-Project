import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { getServerUrl } from '../../../infra/network/serverUrl';

export interface GalleryScore {
  aesthetic_score: number;
  score?: number; // backward compat alias
  label: string;
  composition_score?: number;
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
      if (raw) _scoreCache = JSON.parse(raw);
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
 * Cache a score directly (e.g. from scan mode where the server already scored it).
 */
export async function cacheScore(photoId: string, score: number, label: string = ''): Promise<void> {
  await loadCache();
  _scoreCache[photoId] = { aesthetic_score: score, score, label };
  await saveCache();
}

/**
 * Score a single photo by sending it to the composition server.
 * Call this after capturing and saving a new photo.
 */
export async function scorePhoto(photoId: string, photoUri: string): Promise<GalleryScore | null> {
  await loadCache();
  if (_scoreCache[photoId]) return _scoreCache[photoId];

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

    const result: GalleryScore = {
      aesthetic_score: aestheticScore,
      score: aestheticScore, // backward compat
      label: data.label,
      composition_score: data.composition_score,
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

      _scoreCache[uncached[i].id] = {
        aesthetic_score: aestheticScore,
        score: aestheticScore,
        label: r.label,
        composition_score: r.composition_score,
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
