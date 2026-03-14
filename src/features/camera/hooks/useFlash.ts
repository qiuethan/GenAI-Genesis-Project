import { useState, useCallback, useEffect } from 'react';
import { FlashMode } from '../../../infra/visionCamera';

interface UseFlashReturn {
  flash: FlashMode;
  setFlash: (mode: FlashMode) => void;
  toggleFlash: () => void;
  getFlashIcon: () => string;
  getFlashColor: () => string;
  isTorchActive: boolean;
  sceneBrightness: number;
  setSceneBrightness: (brightness: number) => void;
}

/**
 * Flash mode cycle order (Apple-like): off -> auto -> on -> torch -> off
 */
const FLASH_CYCLE: FlashMode[] = ['off', 'auto', 'on', 'torch'];

/**
 * Hook to manage flash state and behavior
 * Encapsulates flash cycling, icon selection, and torch state
 */
export const useFlash = (hasFlash: boolean = true): UseFlashReturn => {
  const [flash, setFlash] = useState<FlashMode>('off');
  const [sceneBrightness, setSceneBrightness] = useState<number>(0.5);

  const toggleFlash = useCallback(() => {
    if (!hasFlash) return;
    
    setFlash(current => {
      const currentIndex = FLASH_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % FLASH_CYCLE.length;
      return FLASH_CYCLE[nextIndex];
    });
  }, [hasFlash]);

  const getFlashIcon = useCallback((): string => {
    switch (flash) {
      case 'on': return 'flash';
      case 'auto': return 'flash-outline';
      case 'torch': return 'flashlight';
      default: return 'flash-off';
    }
  }, [flash]);

  const getFlashColor = useCallback((): string => {
    return flash === 'torch' || flash === 'on' ? '#ffe81f' : 'white';
  }, [flash]);

  // Cleanup: turn off torch when unmounting
  useEffect(() => {
    return () => {
      if (flash === 'torch') {
        setFlash('off');
      }
    };
  }, []);

  return {
    flash,
    setFlash,
    toggleFlash,
    getFlashIcon,
    getFlashColor,
    isTorchActive: flash === 'torch',
    sceneBrightness,
    setSceneBrightness,
  };
};
