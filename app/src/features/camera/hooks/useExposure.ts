import { useState, useCallback } from 'react';

// Exposure compensation in EV stops (-2 to +2)
export type ExposureValue = -2 | -1 | 0 | 1 | 2;

interface UseExposureReturn {
  exposure: ExposureValue;
  setExposure: (value: ExposureValue) => void;
  cycleExposure: () => void;
  resetExposure: () => void;
  isActive: boolean;
  getExposureIcon: () => string;
  getExposureLabel: () => string;
}

const EXPOSURE_CYCLE: ExposureValue[] = [0, 1, 2, -2, -1];

/**
 * Hook to manage exposure compensation
 * Allows adjustment from -2 EV to +2 EV
 */
export const useExposure = (): UseExposureReturn => {
  const [exposure, setExposure] = useState<ExposureValue>(0);

  const cycleExposure = useCallback(() => {
    setExposure(current => {
      const currentIndex = EXPOSURE_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % EXPOSURE_CYCLE.length;
      return EXPOSURE_CYCLE[nextIndex];
    });
  }, []);

  const resetExposure = useCallback(() => {
    setExposure(0);
  }, []);

  const getExposureIcon = useCallback((): string => {
    return 'aperture';
  }, []);

  const getExposureLabel = useCallback((): string => {
    if (exposure === 0) return '±0';
    return exposure > 0 ? `+${exposure}` : `${exposure}`;
  }, [exposure]);

  return {
    exposure,
    setExposure,
    cycleExposure,
    resetExposure,
    isActive: exposure !== 0,
    getExposureIcon,
    getExposureLabel,
  };
};
