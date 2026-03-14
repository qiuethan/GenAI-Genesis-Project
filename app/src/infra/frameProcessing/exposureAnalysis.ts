/**
 * Exposure Analysis Utilities
 * 
 * Functions for analyzing exposure and detecting clipping.
 * Runs inside worklets.
 */

export interface ExposureMetrics {
  highlightClipPct: number; // 0-1 percentage of pixels clipped high (> 250)
  shadowClipPct: number;    // 0-1 percentage of pixels clipped low (< 5)
  meanLuminance: number;    // 0-255 mean brightness
}

/**
 * Compute exposure metrics from grayscale pixels.
 * 
 * @param pixels - Grayscale pixel values (Y channel)
 * @returns ExposureMetrics
 */
export function computeExposureMetrics(pixels: Uint8Array): ExposureMetrics {
  let sum = 0;
  let highlightCount = 0;
  let shadowCount = 0;
  const len = pixels.length;

  for (let i = 0; i < len; i++) {
    const val = pixels[i];
    sum += val;
    
    // Check for clipping
    // Using 235 for high (Video range white) and 20 for low to be safe
    if (val >= 235) {
      highlightCount++;
    } else if (val <= 20) {
      shadowCount++;
    }
  }

  return {
    highlightClipPct: highlightCount / len,
    shadowClipPct: shadowCount / len,
    meanLuminance: len > 0 ? sum / len : 0,
  };
}
