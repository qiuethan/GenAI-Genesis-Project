import { useState, useCallback, useRef, useEffect } from 'react';
import { useSharedValue, runOnJS } from 'react-native-reanimated';

/**
 * Blur Coach State Machine
 * 
 * Implements EMA smoothing + hysteresis + persistence timers to avoid
 * flickering hints. Only triggers hints when blur is persistently bad.
 */

export interface BlurCoachState {
  isBlurBad: boolean;
  isLowLight: boolean;
  hintText: string | null;
  debugMetrics: {
    sharpness: number;
    sharpnessEMA: number;
    brightness: number;
    thresholdBad: number;
    thresholdOk: number;
    isCalibrated: boolean;
  };
}

export interface BlurCoachConfig {
  emaAlpha?: number;           // EMA smoothing factor (0-1), default 0.3
  badThresholdRatio?: number;  // S_bad = ratio * median, default 0.35
  okThresholdRatio?: number;   // S_ok = ratio * median, default 0.55
  triggerDelayMs?: number;     // Time before showing hint, default 300
  clearDelayMs?: number;       // Time before clearing hint, default 500
  calibrationSamples?: number; // Samples for baseline calibration, default 30
  lowLightThreshold?: number;  // Brightness below this = low light, default 40
}

const DEFAULT_CONFIG: Required<BlurCoachConfig> = {
  emaAlpha: 0.3,
  badThresholdRatio: 0.35,
  okThresholdRatio: 0.55,
  triggerDelayMs: 300,
  clearDelayMs: 500,
  calibrationSamples: 30,
  lowLightThreshold: 40,
};

interface CalibrationState {
  samples: number[];
  isComplete: boolean;
  median: number;
}

/**
 * Hook to manage blur detection state machine.
 * 
 * This hook receives metrics from the frame processor worklet and
 * applies smoothing, hysteresis, and persistence logic to produce
 * stable, actionable hints.
 * 
 * Usage:
 * ```
 * const blurCoach = useBlurCoach();
 * 
 * // In frame processor, call:
 * blurCoach.onMetrics({ sharpness, brightness, timestamp });
 * 
 * // In UI:
 * {blurCoach.state.hintText && <Text>{blurCoach.state.hintText}</Text>}
 * ```
 */
export const useBlurCoach = (config?: BlurCoachConfig) => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // State exposed to UI
  const [state, setState] = useState<BlurCoachState>({
    isBlurBad: false,
    isLowLight: false,
    hintText: null,
    debugMetrics: {
      sharpness: 0,
      sharpnessEMA: 0,
      brightness: 0,
      thresholdBad: 0,
      thresholdOk: 0,
      isCalibrated: false,
    },
  });

  // Internal refs for state machine (not triggering re-renders)
  const emaRef = useRef<number>(0);
  const calibrationRef = useRef<CalibrationState>({
    samples: [],
    isComplete: false,
    median: 0,
  });
  const badSinceRef = useRef<number | null>(null);
  const okSinceRef = useRef<number | null>(null);
  const currentlyBadRef = useRef<boolean>(false);

  // Thresholds (set after calibration)
  const thresholdBadRef = useRef<number>(100);
  const thresholdOkRef = useRef<number>(200);

  /**
   * Process new metrics from frame processor.
   * This is called from the worklet via runOnJS.
   */
  const onMetrics = useCallback((metrics: {
    sharpness: number;
    brightness: number;
    timestamp: number;
  }) => {
    const { sharpness, brightness, timestamp } = metrics;
    const cal = calibrationRef.current;

    // Debug logging (throttled to reduce spam)
    const shouldLog = __DEV__ && Math.random() < 0.1; // Log ~10% of frames

    // --- Calibration Phase ---
    if (!cal.isComplete) {
      cal.samples.push(sharpness);
      
      if (cal.samples.length >= cfg.calibrationSamples) {
        // Compute median
        const sorted = [...cal.samples].sort((a, b) => a - b);
        cal.median = sorted[Math.floor(sorted.length / 2)];
        cal.isComplete = true;
        
        // Set thresholds based on median, with minimum floors
        // For low-variance scenes, ensure thresholds are meaningful
        const rawBad = cal.median * cfg.badThresholdRatio;
        const rawOk = cal.median * cfg.okThresholdRatio;
        
        // Use at least 50% of median as S_bad, and 80% as S_ok
        // This ensures blur is detected when sharpness drops significantly
        thresholdBadRef.current = Math.max(rawBad, cal.median * 0.5);
        thresholdOkRef.current = Math.max(rawOk, cal.median * 0.8);
        
        if (__DEV__) {
          console.log(`[BlurCoach] Calibration complete: median=${cal.median.toFixed(0)}, S_bad=${thresholdBadRef.current.toFixed(0)}, S_ok=${thresholdOkRef.current.toFixed(0)}`);
        }
      }
      
      // Update debug metrics during calibration
      setState(prev => ({
        ...prev,
        debugMetrics: {
          ...prev.debugMetrics,
          sharpness,
          brightness,
          isCalibrated: cal.isComplete,
          thresholdBad: thresholdBadRef.current,
          thresholdOk: thresholdOkRef.current,
        },
      }));
      return;
    }

    // --- EMA Smoothing ---
    const prevEMA = emaRef.current;
    const newEMA = cfg.emaAlpha * sharpness + (1 - cfg.emaAlpha) * prevEMA;
    emaRef.current = newEMA;

    // --- Low Light Detection ---
    const isLowLight = brightness < cfg.lowLightThreshold;

    // --- Hysteresis + Persistence ---
    const S_bad = thresholdBadRef.current;
    const S_ok = thresholdOkRef.current;
    // Convert timestamp from nanoseconds to milliseconds
    const now = timestamp / 1_000_000;

    if (shouldLog) {
      console.log(`[BlurCoach] EMA=${newEMA.toFixed(1)}, S_bad=${S_bad.toFixed(1)}, S_ok=${S_ok.toFixed(1)}, blur=${newEMA < S_bad ? 'BAD' : 'ok'}`);
    }

    let isBlurBad = currentlyBadRef.current;
    let hintText: string | null = null;

    if (!currentlyBadRef.current) {
      // Currently OK - check if becoming bad
      if (newEMA < S_bad) {
        if (badSinceRef.current === null) {
          badSinceRef.current = now;
          if (__DEV__) console.log(`[BlurCoach] Blur detected, waiting for persistence...`);
        } else if (now - badSinceRef.current >= cfg.triggerDelayMs) {
          // Persistent bad - trigger hint
          currentlyBadRef.current = true;
          isBlurBad = true;
          badSinceRef.current = null;
          if (__DEV__) console.log(`[BlurCoach] ⚠️ BLUR BAD - showing hint`);
        }
      } else {
        if (badSinceRef.current !== null && __DEV__) {
          console.log(`[BlurCoach] Blur cleared before persistence threshold`);
        }
        badSinceRef.current = null;
      }
    } else {
      // Currently bad - check if becoming OK
      if (newEMA > S_ok) {
        if (okSinceRef.current === null) {
          okSinceRef.current = now;
        } else if (now - okSinceRef.current >= cfg.clearDelayMs) {
          // Persistent OK - clear hint
          currentlyBadRef.current = false;
          isBlurBad = false;
          okSinceRef.current = null;
        }
      } else {
        okSinceRef.current = null;
      }
    }

    // --- Generate Hint Text ---
    if (isBlurBad) {
      if (isLowLight) {
        hintText = 'Add light or enable Night mode';
      } else {
        hintText = 'Hold still';
      }
    }

    // --- Update State ---
    setState({
      isBlurBad,
      isLowLight,
      hintText,
      debugMetrics: {
        sharpness,
        sharpnessEMA: newEMA,
        brightness,
        thresholdBad: S_bad,
        thresholdOk: S_ok,
        isCalibrated: true,
      },
    });
  }, [cfg]);

  /**
   * Reset calibration (e.g., when switching cameras).
   */
  const resetCalibration = useCallback(() => {
    calibrationRef.current = {
      samples: [],
      isComplete: false,
      median: 0,
    };
    emaRef.current = 0;
    badSinceRef.current = null;
    okSinceRef.current = null;
    currentlyBadRef.current = false;
    
    setState({
      isBlurBad: false,
      isLowLight: false,
      hintText: null,
      debugMetrics: {
        sharpness: 0,
        sharpnessEMA: 0,
        brightness: 0,
        thresholdBad: 0,
        thresholdOk: 0,
        isCalibrated: false,
      },
    });
  }, []);

  return {
    state,
    onMetrics,
    resetCalibration,
  };
};

export type UseBlurCoachReturn = ReturnType<typeof useBlurCoach>;
