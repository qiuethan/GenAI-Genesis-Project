import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Album {
  id: string;
  name: string;
  photoIds: string[];
  createdAt: number;
}

const STORAGE_KEY = '@gallery_albums';

let _albumCache: Album[] = [];
let _cacheLoaded = false;
let _cacheLoadPromise: Promise<void> | null = null;

// Listener set so all mounted useAlbums hooks re-render on mutation
const _listeners = new Set<() => void>();

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

async function loadCache(): Promise<void> {
  if (_cacheLoaded) return;
  if (_cacheLoadPromise) return _cacheLoadPromise;
  _cacheLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) _albumCache = JSON.parse(raw);
    } catch {}
    _cacheLoaded = true;
  })();
  return _cacheLoadPromise;
}

async function saveCache(): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(_albumCache));
  } catch {}
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function createAlbum(name: string, photoIds: string[] = []): Promise<Album> {
  await loadCache();
  const album: Album = {
    id: generateId(),
    name,
    photoIds,
    createdAt: Date.now(),
  };
  _albumCache = [..._albumCache, album];
  await saveCache();
  notifyListeners();
  return album;
}

export async function deleteAlbum(albumId: string): Promise<void> {
  await loadCache();
  _albumCache = _albumCache.filter((a) => a.id !== albumId);
  await saveCache();
  notifyListeners();
}

export async function renameAlbum(albumId: string, name: string): Promise<void> {
  await loadCache();
  _albumCache = _albumCache.map((a) => (a.id === albumId ? { ...a, name } : a));
  await saveCache();
  notifyListeners();
}

export async function addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<void> {
  await loadCache();
  _albumCache = _albumCache.map((a) => {
    if (a.id !== albumId) return a;
    const existing = new Set(a.photoIds);
    const newIds = photoIds.filter((id) => !existing.has(id));
    return { ...a, photoIds: [...a.photoIds, ...newIds] };
  });
  await saveCache();
  notifyListeners();
}

export async function removePhotosFromAlbum(albumId: string, photoIds: string[]): Promise<void> {
  await loadCache();
  const toRemove = new Set(photoIds);
  _albumCache = _albumCache.map((a) => {
    if (a.id !== albumId) return a;
    return { ...a, photoIds: a.photoIds.filter((id) => !toRemove.has(id)) };
  });
  await saveCache();
  notifyListeners();
}

export const useAlbums = () => {
  const [albums, setAlbums] = useState<Album[]>(_albumCache);

  useEffect(() => {
    loadCache().then(() => setAlbums([..._albumCache]));

    // Subscribe to cache mutations so we re-render immediately
    const listener = () => setAlbums([..._albumCache]);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const refresh = useCallback(() => {
    setAlbums([..._albumCache]);
  }, []);

  return { albums, refresh };
};
