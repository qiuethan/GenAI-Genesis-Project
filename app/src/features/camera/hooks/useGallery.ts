import { useState, useEffect, useCallback, useRef } from 'react';
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
  // Use refs for pagination cursors — they don't affect rendering
  // and keeping them out of useCallback deps prevents re-render loops.
  const endCursorRef = useRef<string | undefined>();
  const hasNextPageRef = useRef(false);

  const loadPhotos = useCallback(async (isRefresh: boolean = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await getPhotos({
        first: initialCount,
        after: isRefresh ? undefined : endCursorRef.current,
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

      endCursorRef.current = result.endCursor;
      hasNextPageRef.current = result.hasNextPage;
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load photos',
      }));
    }
  }, [initialCount]);

  const refresh = useCallback(async () => {
    endCursorRef.current = undefined;
    await loadPhotos(true);
  }, [loadPhotos]);

  const loadMore = useCallback(async () => {
    if (!hasNextPageRef.current || state.loading) return;
    await loadPhotos(false);
  }, [state.loading, loadPhotos]);

  useEffect(() => {
    loadPhotos(true);
  }, [loadPhotos]);

  return {
    ...state,
    refresh,
    loadMore,
  };
};
