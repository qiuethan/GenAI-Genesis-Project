import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@auto_score_enabled';

let _autoScoreEnabled = false;
let _loaded = false;
let _loadPromise: Promise<void> | null = null;

export async function loadAutoScore(): Promise<void> {
  if (_loaded) return;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw !== null) _autoScoreEnabled = raw === 'true';
    } catch {}
    _loaded = true;
  })();
  return _loadPromise;
}

/** Synchronous read — call loadAutoScore() first to warm the cache. */
export function getAutoScoreEnabled(): boolean {
  return _autoScoreEnabled;
}

/** Hook for settings UI. */
export const useAutoScore = () => {
  const [enabled, setEnabledState] = useState(_autoScoreEnabled);

  useEffect(() => {
    loadAutoScore().then(() => setEnabledState(_autoScoreEnabled));
  }, []);

  const setEnabled = useCallback(async (value: boolean) => {
    _autoScoreEnabled = value;
    setEnabledState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(value));
    } catch {}
  }, []);

  return { enabled, setEnabled };
};
