import { useState, useCallback } from 'react';

export type ColorFilterType = 
  | 'none'
  | 'vivid'
  | 'dramatic'
  | 'mono'
  | 'silvertone'
  | 'noir';

interface ColorFilter {
  type: ColorFilterType;
  label: string;
  // These values can be used with image processing
  saturation?: number;
  contrast?: number;
  brightness?: number;
  grayscale?: boolean;
}

const COLOR_FILTERS: ColorFilter[] = [
  { type: 'none', label: 'Original' },
  { type: 'vivid', label: 'Vivid', saturation: 1.3, contrast: 1.1 },
  { type: 'dramatic', label: 'Dramatic', contrast: 1.4, saturation: 0.9 },
  { type: 'mono', label: 'Mono', grayscale: true },
  { type: 'silvertone', label: 'Silvertone', grayscale: true, contrast: 1.2 },
  { type: 'noir', label: 'Noir', grayscale: true, contrast: 1.5, brightness: 0.9 },
];

interface UseColorFilterReturn {
  filter: ColorFilterType;
  filterConfig: ColorFilter;
  setFilter: (filter: ColorFilterType) => void;
  cycleFilter: () => void;
  isActive: boolean;
  getFilterIcon: () => string;
  getFilterLabel: () => string;
  allFilters: ColorFilter[];
}

/**
 * Hook to manage color filters/effects
 * Provides various photographic styles
 */
export const useColorFilter = (): UseColorFilterReturn => {
  const [filter, setFilter] = useState<ColorFilterType>('none');

  const cycleFilter = useCallback(() => {
    setFilter(current => {
      const currentIndex = COLOR_FILTERS.findIndex(f => f.type === current);
      const nextIndex = (currentIndex + 1) % COLOR_FILTERS.length;
      return COLOR_FILTERS[nextIndex].type;
    });
  }, []);

  const getFilterIcon = useCallback((): string => {
    return 'color-filter';
  }, []);

  const getFilterLabel = useCallback((): string => {
    const currentFilter = COLOR_FILTERS.find(f => f.type === filter);
    return currentFilter?.label || 'Original';
  }, [filter]);

  const filterConfig = COLOR_FILTERS.find(f => f.type === filter) || COLOR_FILTERS[0];

  return {
    filter,
    filterConfig,
    setFilter,
    cycleFilter,
    isActive: filter !== 'none',
    getFilterIcon,
    getFilterLabel,
    allFilters: COLOR_FILTERS,
  };
};
