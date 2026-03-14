'use strict';

/**
 * Blur Analysis Utilities
 * 
 * Pure functions for computing sharpness and brightness metrics.
 * These run inside worklets - no React hooks, no allocations in hot path.
 * 
 * Performance notes:
 * - All functions are designed to minimize allocations
 * - Use typed arrays where possible
 * - Avoid creating new objects in the analysis loop
 */

export interface BlurMetrics {
  sharpness: number;      // Laplacian variance (higher = sharper)
  brightness: number;     // Mean luminance 0-255
  timestamp: number;      // Frame timestamp
}

/**
 * Compute sharpness using variance of Laplacian approximation.
 * 
 * Uses a simplified 3x3 Laplacian kernel:
 *   0  1  0
 *   1 -4  1
 *   0  1  0
 * 
 * We compute the variance of the Laplacian response, which correlates
 * with image sharpness. Higher variance = sharper image.
 * 
 * @param pixels - Grayscale pixel values (Y channel or luminance)
 * @param width - Image width
 * @param height - Image height
 * @returns Laplacian variance (sharpness score)
 */
export function computeLaplacianVariance(
  pixels: Uint8Array,
  width: number,
  height: number
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  // Skip border pixels (1px margin for 3x3 kernel)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      
      // Laplacian: center * -4 + neighbors
      const laplacian = 
        -4 * pixels[idx] +
        pixels[idx - width] +     // top
        pixels[idx + width] +     // bottom
        pixels[idx - 1] +         // left
        pixels[idx + 1];          // right
      
      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  if (count === 0) return 0;

  const mean = sum / count;
  const variance = (sumSq / count) - (mean * mean);
  
  return Math.max(0, variance);
}

/**
 * Compute mean brightness (luminance) of the image.
 * 
 * @param pixels - Grayscale pixel values
 * @returns Mean luminance 0-255
 */
export function computeMeanBrightness(pixels: Uint8Array): number {
  if (pixels.length === 0) return 0;
  
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) {
    sum += pixels[i];
  }
  
  return sum / pixels.length;
}

/**
 * Extract Y (luminance) channel from YUV/NV21 frame data.
 * VisionCamera provides frames in YUV format on both iOS and Android.
 * The Y plane is the first width*height bytes.
 * 
 * This function extracts a center ROI for efficient processing.
 * 
 * @param frameData - Raw frame buffer (YUV format)
 * @param frameWidth - Full frame width
 * @param frameHeight - Full frame height
 * @param roiSize - Size of center ROI to extract (e.g., 64 or 128)
 * @returns Grayscale pixels of the center ROI
 */
export function extractCenterROI(
  frameData: Uint8Array,
  frameWidth: number,
  frameHeight: number,
  roiSize: number
): Uint8Array {
  const startX = Math.floor((frameWidth - roiSize) / 2);
  const startY = Math.floor((frameHeight - roiSize) / 2);
  
  const roi = new Uint8Array(roiSize * roiSize);
  
  for (let y = 0; y < roiSize; y++) {
    const srcOffset = (startY + y) * frameWidth + startX;
    const dstOffset = y * roiSize;
    
    for (let x = 0; x < roiSize; x++) {
      roi[dstOffset + x] = frameData[srcOffset + x];
    }
  }
  
  return roi;
}

/**
 * Downsample grayscale image by averaging 2x2 blocks.
 * Reduces image to half size in each dimension.
 * 
 * @param pixels - Input grayscale pixels
 * @param width - Input width (must be even)
 * @param height - Input height (must be even)
 * @returns Downsampled pixels
 */
export function downsample2x(
  pixels: Uint8Array,
  width: number,
  height: number
): { pixels: Uint8Array; width: number; height: number } {
  const newWidth = Math.floor(width / 2);
  const newHeight = Math.floor(height / 2);
  const result = new Uint8Array(newWidth * newHeight);
  
  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = x * 2;
      const srcY = y * 2;
      const srcIdx = srcY * width + srcX;
      
      // Average 2x2 block
      const avg = (
        pixels[srcIdx] +
        pixels[srcIdx + 1] +
        pixels[srcIdx + width] +
        pixels[srcIdx + width + 1]
      ) / 4;
      
      result[y * newWidth + x] = avg;
    }
  }
  
  return { pixels: result, width: newWidth, height: newHeight };
}
