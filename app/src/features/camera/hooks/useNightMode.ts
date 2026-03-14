import { useState, useCallback } from 'react';

export type NightModeState = 'off' | 'auto' | 'on';

interface UseNightModeReturn {
  nightMode: NightModeState;
  setNightMode: (mode: NightModeState) => void;
  cycleNightMode: () => void;
  isActive: boolean;
  getNightModeIcon: () => string;
  getNightModeColor: () => string;
}

const NIGHT_MODE_CYCLE: NightModeState[] = ['off', 'auto', 'on'];

/**
 * Hook to manage night/low-light mode
 * Controls extended exposure for low-light photography
 */
export const useNightMode = (): UseNightModeReturn => {
  const [nightMode, setNightMode] = useState<NightModeState>('off');

  const cycleNightMode = useCallback(() => {
    setNightMode(current => {
      const currentIndex = NIGHT_MODE_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % NIGHT_MODE_CYCLE.length;
      return NIGHT_MODE_CYCLE[nextIndex];
    });
  }, []);

  const getNightModeIcon = useCallback((): string => {
    return 'moon';
  }, []);

  const getNightModeColor = useCallback((): string => {
    return nightMode !== 'off' ? '#ffe81f' : 'white';
  }, [nightMode]);

  return {
    nightMode,
    setNightMode,
    cycleNightMode,
    isActive: nightMode !== 'off',
    getNightModeIcon,
    getNightModeColor,
  };
};
