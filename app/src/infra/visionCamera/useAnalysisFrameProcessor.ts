import { useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { computeLaplacianVariance, computeMeanBrightness } from '../frameProcessing/blurAnalysis';
import { computeExposureMetrics, ExposureMetrics } from '../frameProcessing/exposureAnalysis';

interface AnalysisFrameProcessorConfig {
  onBlurMetrics?: (metrics: { sharpness: number; brightness: number; timestamp: number }) => void;
  onExposureMetrics?: (metrics: ExposureMetrics) => void;
  roiSize?: number;        // Size of center ROI, default 128
  skipFrames?: number;     // Process every N frames, default 5
  enabled?: boolean;
}

/**
 * Combined Frame Processor for Camera Analysis
 * Runs both Blur detection and Exposure analysis on a shared ROI.
 */
export const useAnalysisFrameProcessor = ({
  onBlurMetrics,
  onExposureMetrics,
  roiSize = 128,
  skipFrames = 5,
  enabled = true,
}: AnalysisFrameProcessorConfig) => {
  
  // Worklet-safe callbacks
  const onBlurWorklet = useMemo(
    () => onBlurMetrics ? Worklets.createRunOnJS(onBlurMetrics) : undefined,
    [onBlurMetrics]
  );
  
  const onExposureWorklet = useMemo(
    () => onExposureMetrics ? Worklets.createRunOnJS(onExposureMetrics) : undefined,
    [onExposureMetrics]
  );

  return useFrameProcessor((frame) => {
    'worklet';
    
    const frameCount = Math.floor(frame.timestamp / 33) % skipFrames;
    if (frameCount !== 0 || !enabled) return;

    try {
      const width = frame.width;
      const height = frame.height;
      const stride = frame.bytesPerRow ?? width; // Use bytesPerRow for correct stride
      const timestamp = frame.timestamp;

      // Get frame buffer (Y plane)
      const buffer = frame.toArrayBuffer();
      const pixels = new Uint8Array(buffer);

      // Extract ROI
      const startX = Math.floor((width - roiSize) / 2);
      const startY = Math.floor((height - roiSize) / 2);
      
      const roi = new Uint8Array(roiSize * roiSize);
      

      for (let y = 0; y < roiSize; y++) {
        const srcOffset = (startY + y) * stride + startX;
        const dstOffset = y * roiSize;
        for (let x = 0; x < roiSize; x++) {
          roi[dstOffset + x] = pixels[srcOffset + x];
        }
      }

      // 1. Blur Analysis
      if (onBlurWorklet) {
        // computeLaplacianVariance expects width/height
        // It operates on the extracted ROI, so width=roiSize
        const sharpness = computeLaplacianVariance(roi, roiSize, roiSize);
        const brightness = computeMeanBrightness(roi);
        
        onBlurWorklet({
          sharpness,
          brightness,
          timestamp,
        });
      }

      // 2. Exposure Analysis (Compute unconditionally for debug)
      const exposureMetrics = computeExposureMetrics(roi);
      

      if (onExposureWorklet) {
        onExposureWorklet(exposureMetrics);
      }

    } catch (e) {
      // Ignore
    }
  }, [onBlurWorklet, onExposureWorklet, roiSize, skipFrames, enabled]);
};
