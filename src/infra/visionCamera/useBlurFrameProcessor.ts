import { useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

/**
 * Frame Processor Hook for Blur Detection
 * 
 * Creates a frame processor that analyzes frames for blur/sharpness.
 * Runs at ~10-15 Hz by skipping frames, extracts a small center ROI,
 * and computes Laplacian variance for sharpness + mean for brightness.
 * 
 * Performance optimizations:
 * - Skips frames to run at ~10-15 Hz instead of 30 Hz
 * - Extracts small center ROI (64x64) instead of full frame
 * - Uses Y channel only (grayscale) from YUV data
 * - Minimal allocations in the hot path
 * 
 * Compatibility:
 * - VisionCamera 4.x with react-native-worklets-core
 * - iOS and Android (YUV format)
 */

interface BlurFrameProcessorConfig {
  onMetrics: (metrics: { sharpness: number; brightness: number; timestamp: number }) => void;
  roiSize?: number;        // Size of center ROI, default 64
  skipFrames?: number;     // Process every N frames, default 3 (10 Hz at 30fps)
  enabled?: boolean;       // Enable/disable processing
}

/**
 * Hook that returns a frame processor for blur detection.
 * 
 * Usage:
 * ```
 * const blurCoach = useBlurCoach();
 * const frameProcessor = useBlurFrameProcessor({
 *   onMetrics: blurCoach.onMetrics,
 * });
 * 
 * <Camera frameProcessor={frameProcessor} ... />
 * ```
 */
export const useBlurFrameProcessor = ({
  onMetrics,
  roiSize = 64,
  skipFrames = 3,
  enabled = true,
}: BlurFrameProcessorConfig) => {
  // Create a worklet-safe callback using react-native-worklets-core
  const onMetricsWorklet = useMemo(
    () => Worklets.createRunOnJS(onMetrics),
    [onMetrics]
  );

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // Simple frame counter for throttling (worklet-safe)
    const frameCount = Math.floor(frame.timestamp / 33) % skipFrames; // ~30fps = 33ms per frame
    if (frameCount !== 0 || !enabled) {
      return;
    }

    try {
      const width = frame.width;
      const height = frame.height;
      const timestamp = frame.timestamp;

      // Get frame buffer - this is the Y plane (luminance) for YUV frames
      // VisionCamera 4.x provides toArrayBuffer() for CPU access
      const buffer = frame.toArrayBuffer();
      const pixels = new Uint8Array(buffer);

      // Extract center ROI from Y plane
      // Y plane is first width*height bytes in YUV format
      const startX = Math.floor((width - roiSize) / 2);
      const startY = Math.floor((height - roiSize) / 2);
      
      // Compute metrics on the ROI
      let sum = 0;
      let laplacianSum = 0;
      let laplacianSumSq = 0;
      let count = 0;

      // Process ROI with Laplacian kernel
      for (let y = 1; y < roiSize - 1; y++) {
        for (let x = 1; x < roiSize - 1; x++) {
          const frameY = startY + y;
          const frameX = startX + x;
          const idx = frameY * width + frameX;
          
          const center = pixels[idx];
          sum += center;
          
          // Laplacian: -4*center + top + bottom + left + right
          const laplacian = 
            -4 * center +
            pixels[(frameY - 1) * width + frameX] +
            pixels[(frameY + 1) * width + frameX] +
            pixels[frameY * width + (frameX - 1)] +
            pixels[frameY * width + (frameX + 1)];
          
          laplacianSum += laplacian;
          laplacianSumSq += laplacian * laplacian;
          count++;
        }
      }

      if (count === 0) return;

      // Compute variance of Laplacian (sharpness metric)
      const laplacianMean = laplacianSum / count;
      const laplacianVariance = (laplacianSumSq / count) - (laplacianMean * laplacianMean);
      const sharpness = Math.max(0, laplacianVariance);

      // Compute mean brightness
      const brightness = sum / (roiSize * roiSize);

      // Send metrics to JS thread using VisionCamera's worklet-safe callback
      onMetricsWorklet({
        sharpness,
        brightness,
        timestamp,
      });
    } catch (e) {
      // Silently ignore errors to avoid log spam
    }
  }, [onMetricsWorklet, roiSize, skipFrames, enabled]);

  return frameProcessor;
};
