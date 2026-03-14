import { useState, useEffect, useCallback } from 'react';
import { getPhotos, PhotoAsset } from '../../../infra/mediaLibrary';

interface UseGalleryState {
  photos: PhotoAsset[];
  loading: boolean;
  hasPermission: boolean;
  error: string | null;
}

interface UseGalleryReturn extends UseGalleryState {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Hook to manage gallery state and photo loading
 * Encapsulates all gallery business logic
 */
export const useGallery = (initialCount: number = 100): UseGalleryReturn => {
  const [state, setState] = useState<UseGalleryState>({
    photos: [],
    loading: true,
    hasPermission: false,
    error: null,
  });
  const [endCursor, setEndCursor] = useState<string | undefined>();
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadPhotos = useCallback(async (isRefresh: boolean = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await getPhotos({
        first: initialCount,
        after: isRefresh ? undefined : endCursor,
      });

      if (result === null) {
        setState(prev => ({
          ...prev,
          loading: false,
          hasPermission: false,
          error: 'Permission not granted',
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        photos: isRefresh ? result.assets : [...prev.photos, ...result.assets],
        loading: false,
        hasPermission: true,
      }));

      setEndCursor(result.endCursor);
      setHasNextPage(result.hasNextPage);
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load photos',
      }));
    }
  }, [initialCount, endCursor]);

  const refresh = useCallback(async () => {
    setEndCursor(undefined);
    await loadPhotos(true);
  }, [loadPhotos]);

  const loadMore = useCallback(async () => {
    if (!hasNextPage || state.loading) return;
    await loadPhotos(false);
  }, [hasNextPage, state.loading, loadPhotos]);

  useEffect(() => {
    loadPhotos(true);
  }, []);

  return {
    ...state,
    refresh,
    loadMore,
  };
};
