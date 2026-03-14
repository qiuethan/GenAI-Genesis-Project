import { useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { computeExposureMetrics, ExposureMetrics } from '../frameProcessing/exposureAnalysis';

interface ExposureFrameProcessorConfig {
  onMetrics: (metrics: ExposureMetrics) => void;
  roiSize?: number;        // Size of center ROI, default 128
  skipFrames?: number;     // Process every N frames, default 5 (~6 Hz)
  enabled?: boolean;       // Enable/disable processing
}

/**
 * Hook that returns a frame processor for exposure clipping detection.
 */
export const useExposureFrameProcessor = ({
  onMetrics,
  roiSize = 128,
  skipFrames = 5,
  enabled = true,
}: ExposureFrameProcessorConfig) => {
  // Create a worklet-safe callback using react-native-worklets-core
  const onMetricsWorklet = useMemo(
    () => Worklets.createRunOnJS(onMetrics),
    [onMetrics]
  );

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // Simple frame counter for throttling (worklet-safe)
    const frameCount = Math.floor(frame.timestamp / 33) % skipFrames; 
    if (frameCount !== 0 || !enabled) {
      return;
    }

    try {
      const width = frame.width;
      const height = frame.height;

      // Get frame buffer (Y plane)
      const buffer = frame.toArrayBuffer();
      const pixels = new Uint8Array(buffer);

      const startX = Math.floor((width - roiSize) / 2);
      const startY = Math.floor((height - roiSize) / 2);
      
      // Extract ROI manually to avoid dependencies
      // 128x128 is small enough that allocation is acceptable
      const roi = new Uint8Array(roiSize * roiSize);
      
      for (let y = 0; y < roiSize; y++) {
        const srcOffset = (startY + y) * width + startX;
        const dstOffset = y * roiSize;
        
        // Manual copy loop is often faster/safer in worklets than subarray/set
        for (let x = 0; x < roiSize; x++) {
          roi[dstOffset + x] = pixels[srcOffset + x];
        }
      }

      const metrics = computeExposureMetrics(roi);
      onMetricsWorklet(metrics);
    } catch (e) {
      // Silently ignore errors
    }
  }, [onMetricsWorklet, roiSize, skipFrames, enabled]);

  return frameProcessor;
};
