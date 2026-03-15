import { useState, useEffect, useRef } from 'react';
import { useMotionDetector } from '../../../infra/sensors';

/**
 * Shake Coach Hook
 * 
 * Provides coaching hints based on device motion/shake detection.
 * Uses accelerometer and gyroscope to detect movement that would
 * cause motion blur in photos.
 * 
 * Much more reliable than frame-based blur detection since iOS
 * video pipeline already applies stabilization to preview frames.
 */

interface ShakeCoachConfig {
  /** Delay before showing hint (ms) - prevents flicker */
  triggerDelayMs?: number;
  /** Delay before clearing hint (ms) - prevents flicker */
  clearDelayMs?: number;
  /** Enable/disable the coach */
  enabled?: boolean;
}

export interface ShakeCoachState {
  /** Whether device is shaking enough to cause blur */
  isShaking: boolean;
  /** Hint text to display, null if no hint */
  hintText: string | null;
  /** Debug metrics for development */
  debugMetrics: {
    magnitude: number;
    accelMagnitude: number;
    gyroMagnitude: number;
    isShaking: boolean;
  };
}

const DEFAULT_CONFIG: Required<ShakeCoachConfig> = {
  triggerDelayMs: 100,  // Show hint after 100ms of shake
  clearDelayMs: 200,    // Clear hint after 200ms of steady
  enabled: true,
};

export const useShakeCoach = (config?: ShakeCoachConfig): {
  state: ShakeCoachState;
} => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const motion = useMotionDetector({
    updateInterval: 50,
    smoothingFactor: 0.3,
    useGyroscope: true,
  });

  const [state, setState] = useState<ShakeCoachState>({
    isShaking: false,
    hintText: null,
    debugMetrics: {
      magnitude: 0,
      accelMagnitude: 0,
      gyroMagnitude: 0,
      isShaking: false,
    },
  });

  // Persistence tracking
  const shakingSinceRef = useRef<number | null>(null);
  const steadySinceRef = useRef<number | null>(null);
  const showingHintRef = useRef(false);

  useEffect(() => {
    if (!cfg.enabled) {
      setState(prev => ({
        ...prev,
        isShaking: false,
        hintText: null,
      }));
      return;
    }

    const now = Date.now();

    // Update debug metrics always
    const debugMetrics = {
      magnitude: motion.magnitude,
      accelMagnitude: motion.accelMagnitude,
      gyroMagnitude: motion.gyroMagnitude,
      isShaking: motion.isShaking,
    };

    if (!showingHintRef.current) {
      // Currently not showing hint - check if should show
      if (motion.isShaking) {
        if (shakingSinceRef.current === null) {
          shakingSinceRef.current = now;
        } else if (now - shakingSinceRef.current >= cfg.triggerDelayMs) {
          // Persistent shake - show hint
          showingHintRef.current = true;
          shakingSinceRef.current = null;
          setState({
            isShaking: true,
            hintText: 'Hold still',
            debugMetrics,
          });
          return;
        }
      } else {
        shakingSinceRef.current = null;
      }
    } else {
      // Currently showing hint - check if should clear
      if (!motion.isShaking) {
        if (steadySinceRef.current === null) {
          steadySinceRef.current = now;
        } else if (now - steadySinceRef.current >= cfg.clearDelayMs) {
          // Persistent steady - clear hint
          showingHintRef.current = false;
          steadySinceRef.current = null;
          setState({
            isShaking: false,
            hintText: null,
            debugMetrics,
          });
          return;
        }
      } else {
        steadySinceRef.current = null;
      }
    }

    // Update debug metrics without changing hint state
    setState(prev => ({
      ...prev,
      debugMetrics,
    }));
  }, [motion.isShaking, motion.magnitude, motion.accelMagnitude, motion.gyroMagnitude, cfg.enabled, cfg.triggerDelayMs, cfg.clearDelayMs]);

  return { state };
};
