/**
 * On-device YOLO object detection via CoreML frame processor plugin.
 */

import { useCallback, useRef, useState, useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { VisionCameraProxy } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';

export interface Detection {
  label: string;
  confidence: number;
  x1: number;  // normalized 0-1
  y1: number;
  x2: number;
  y2: number;
}

interface UseObjectDetectionConfig {
  enabled: boolean;
  confidenceThreshold?: number;
  skipFrames?: number;
}

export const useObjectDetection = ({
  enabled,
  confidenceThreshold = 0.3,
  skipFrames = 3,
}: UseObjectDetectionConfig) => {
  const [detections, setDetections] = useState<Detection[]>([]);

  // Initialize the native plugin once
  const plugin = useMemo(() => {
    try {
      const p = VisionCameraProxy.initFrameProcessorPlugin('detectObjects', {});
      if (p == null) {
        console.warn('[ObjectDetection] Plugin not found — is the native module compiled?');
      } else {
        console.log('[ObjectDetection] Plugin loaded');
      }
      return p;
    } catch (e) {
      console.warn('[ObjectDetection] Failed to init plugin:', e);
      return null;
    }
  }, []);

  const onDetections = useCallback((dets: Detection[]) => {
    setDetections(dets);
  }, []);

  const onDetectionsWorklet = useMemo(
    () => Worklets.createRunOnJS(onDetections),
    [onDetections]
  );

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    if (!enabled || plugin == null) return;

    // Simple frame skip using timestamp
    const frameNum = Math.floor(frame.timestamp / 33) % skipFrames;
    if (frameNum !== 0) return;

    try {
      const results = plugin.call(frame, { confidence: confidenceThreshold });

      if (results && Array.isArray(results)) {
        onDetectionsWorklet(results as unknown as Detection[]);
      }
    } catch (e) {
      // ignore frame processor errors
    }
  }, [enabled, plugin, confidenceThreshold, skipFrames, onDetectionsWorklet]);

  return {
    detections,
    frameProcessor: enabled ? frameProcessor : undefined,
  };
};
