import { useState, useCallback } from 'react';
import { ExposureMetrics } from '../../../infra/frameProcessing/exposureAnalysis';

export interface ExposureCoachState {
  metrics: ExposureMetrics | null;
  hintText: string | null;
}

const HIGHLIGHT_THRESHOLD = 0.01; // 1% pixels clipped
const SHADOW_THRESHOLD = 0.05;    // 5% pixels clipped
const LOW_LIGHT_MEAN_THRESHOLD = 40; // If mean < 40, assume intentional dark scene

export const useExposureCoach = () => {
  const [state, setState] = useState<ExposureCoachState>({
    metrics: null,
    hintText: null,
  });

  const onMetrics = useCallback((metrics: ExposureMetrics) => {
    let hint: string | null = null;
    
    // Debug logging
    if (__DEV__) {
      // Throttle logs slightly to avoid spamming every frame (approx 10% chance)
      if (Math.random() < 0.1) {
        console.log(`[ExposureCoach] Highlights: ${(metrics.highlightClipPct * 100).toFixed(1)}%, Shadows: ${(metrics.shadowClipPct * 100).toFixed(1)}%, Mean: ${metrics.meanLuminance.toFixed(1)}`);
      }
    }

    if (metrics.highlightClipPct > HIGHLIGHT_THRESHOLD) {
      hint = 'Too bright — tap to expose';
    } else if (metrics.shadowClipPct > SHADOW_THRESHOLD) {
      // Only warn about shadows if the overall scene isn't intentionally very dark
      if (metrics.meanLuminance > LOW_LIGHT_MEAN_THRESHOLD) {
        hint = 'Too dark — add light';
      }
    }

    setState({
      metrics,
      hintText: hint,
    });
  }, []);

  return {
    state,
    onMetrics,
  };
};
