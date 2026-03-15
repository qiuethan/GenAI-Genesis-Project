import { useState, useCallback, useRef } from 'react';
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

  const prevHintRef = useRef<string | null>(null);

  const onMetrics = useCallback((metrics: ExposureMetrics) => {
    let hint: string | null = null;

    if (metrics.highlightClipPct > HIGHLIGHT_THRESHOLD) {
      hint = 'Too bright — tap to expose';
    } else if (metrics.shadowClipPct > SHADOW_THRESHOLD) {
      if (metrics.meanLuminance > LOW_LIGHT_MEAN_THRESHOLD) {
        hint = 'Too dark — add light';
      }
    }

    // Only re-render when the hint actually changes
    if (hint !== prevHintRef.current) {
      prevHintRef.current = hint;
      setState({ metrics, hintText: hint });
    }
  }, []);

  return {
    state,
    onMetrics,
  };
};
