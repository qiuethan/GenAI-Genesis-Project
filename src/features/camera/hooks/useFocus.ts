import { useState, useCallback, useRef, useEffect } from 'react';
import { CameraHandle } from '../../../infra/visionCamera';

export interface FocusPoint {
  x: number;
  y: number;
}

interface UseFocusReturn {
  focusPoint: FocusPoint | null;
  isFocusing: boolean;
  focus: (point: FocusPoint, cameraRef: React.RefObject<CameraHandle | null>) => Promise<void>;
  resetFocus: () => void;
}

/**
 * Hook to manage tap-to-focus functionality
 * Handles focus point state and camera focus commands
 */
export const useFocus = (): UseFocusReturn => {
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [isFocusing, setIsFocusing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const focus = useCallback(async (point: FocusPoint, cameraRef: React.RefObject<CameraHandle | null>) => {
    if (!cameraRef.current) return;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setFocusPoint(point);
    setIsFocusing(true);

    try {
      await cameraRef.current.focus(point);
    } catch (error) {
      // Focus may fail on some devices or if point is out of bounds
      console.warn('Focus failed:', error);
    }

    // Hide focus indicator after 1.5 seconds
    timeoutRef.current = setTimeout(() => {
      setIsFocusing(false);
      // Keep focusPoint for a bit longer for smooth animation
      setTimeout(() => {
        setFocusPoint(null);
      }, 300);
    }, 1500);
  }, []);

  const resetFocus = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setFocusPoint(null);
    setIsFocusing(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    focusPoint,
    isFocusing,
    focus,
    resetFocus,
  };
};
