import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { getServerUrl } from '../../../infra/network/serverUrl';

export interface GalleryScore {
  score: number;
  label: string;
}

const STORAGE_KEY = '@composition_scores';

let _scoreCache: Record<string, GalleryScore> = {};
let _cacheLoaded = false;
let _cacheLoadPromise: Promise<void> | null = null;

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

/**
 * Cache a score directly (e.g. from scan mode where the server already scored it).
 */
export async function cacheScore(photoId: string, score: number, label: string = ''): Promise<void> {
  await loadCache();
  _scoreCache[photoId] = { score, label };
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
    if (data.score === undefined) return null;

    const result: GalleryScore = { score: data.score, label: data.label };
    _scoreCache[photoId] = result;
    await saveCache();
    return result;
  } catch {
    return null;
  }
}

/**
 * Hook that provides access to cached composition scores.
 * Does NOT score photos automatically — call scorePhoto() after capture.
 */
export const useGalleryScores = () => {
  const [scores, setScores] = useState<Record<string, GalleryScore>>(_scoreCache);

  // Load from disk on mount
  useEffect(() => {
    loadCache().then(() => setScores({ ..._scoreCache }));
  }, []);

  // Call this after scorePhoto() to refresh the UI
  const refresh = useCallback(() => {
    setScores({ ..._scoreCache });
  }, []);

  return { scores, refresh };
};
