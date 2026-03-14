import { CameraDevice } from 'react-native-vision-camera';

// ============================================================================
// Types
// ============================================================================

export interface ZoomStop {
  label: string;
  zoom: number;
}

export interface ZoomConfig {
  minZoom: number;
  maxZoom: number;
  neutralZoom: number;
  stops: ZoomStop[];
}

// ============================================================================
// Constants
// ============================================================================

const PINCH_DAMPING = 0.6;
const SMOOTHING_ALPHA = 0.3;
const JITTER_THRESHOLD = 0.003;
const ULTRA_WIDE_THRESHOLD = 0.7;
const TELEPHOTO_THRESHOLD = 1.7;

// ============================================================================
// Config
// ============================================================================

export function getZoomConfig(device: CameraDevice | undefined): ZoomConfig {
  if (!device) {
    return {
      minZoom: 1,
      maxZoom: 1,
      neutralZoom: 1,
      stops: [{ label: '1x', zoom: 1 }],
    };
  }

  const minZoom = device.minZoom;
  const maxZoom = device.maxZoom;
  const neutralZoom = (device as any).neutralZoom ?? 1;

  const stops: ZoomStop[] = [];

  if (minZoom <= neutralZoom * ULTRA_WIDE_THRESHOLD) {
    stops.push({ label: '0.5x', zoom: minZoom });
  }

  stops.push({ label: '1x', zoom: neutralZoom });

  if (maxZoom >= neutralZoom * TELEPHOTO_THRESHOLD) {
    stops.push({ label: '2x', zoom: Math.min(neutralZoom * 2, maxZoom) });
  }

  return { minZoom, maxZoom, neutralZoom, stops };
}

// ============================================================================
// Core Zoom Functions
// ============================================================================

export function clampZoom(zoom: number, config: ZoomConfig): number {
  return Math.max(config.minZoom, Math.min(config.maxZoom, zoom));
}

export function applyIncrementalPinchZoom(
  currentZoom: number,
  currentScale: number,
  lastScale: number,
  config: ZoomConfig
): number {
  const ratio = currentScale / lastScale;
  const dampedRatio = Math.pow(ratio, PINCH_DAMPING);
  const targetZoom = currentZoom * dampedRatio;
  return clampZoom(targetZoom, config);
}

// ============================================================================
// Smoothing
// ============================================================================

export function smoothZoom(
  currentSmoothed: number,
  target: number,
  alpha: number = SMOOTHING_ALPHA
): number {
  return currentSmoothed + alpha * (target - currentSmoothed);
}

export function shouldSuppressJitter(
  target: number,
  smoothed: number,
  neutralZoom: number
): boolean {
  return Math.abs(target - smoothed) / neutralZoom < JITTER_THRESHOLD;
}

export function formatZoomDisplay(zoom: number, neutralZoom: number): string {
  const displayZoom = zoom / neutralZoom;
  
  if (displayZoom < 1) {
    return `${displayZoom.toFixed(1)}x`;
  }
  
  if (Math.abs(displayZoom - Math.round(displayZoom)) < 0.05) {
    return `${Math.round(displayZoom)}x`;
  }
  
  return `${displayZoom.toFixed(1)}x`;
}
