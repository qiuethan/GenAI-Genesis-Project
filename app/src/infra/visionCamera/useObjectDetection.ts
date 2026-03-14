/**
 * On-device YOLO object detection via CoreML frame processor plugin.
 */

import { useCallback, useState, useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { VisionCameraProxy } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { getOrientation } from '../sensors/deviceOrientation';

export interface Detection {
  label: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface RawDetection {
  label: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function transformDetection(raw: RawDetection, orientation: number): Detection {
  let x1: number, y1: number, x2: number, y2: number;
  switch (orientation) {
    case 0:
      x1 = 1 - raw.y2; y1 = raw.x1; x2 = 1 - raw.y1; y2 = raw.x2; break;
    case 90:
      x1 = raw.x1; y1 = raw.y1; x2 = raw.x2; y2 = raw.y2; break;
    case 180:
      x1 = raw.y1; y1 = 1 - raw.x2; x2 = raw.y2; y2 = 1 - raw.x1; break;
    case 270:
      x1 = 1 - raw.x2; y1 = 1 - raw.y2; x2 = 1 - raw.x1; y2 = 1 - raw.y1; break;
    default:
      x1 = 1 - raw.y2; y1 = raw.x1; x2 = 1 - raw.y1; y2 = raw.x2;
  }
  return {
    label: raw.label, confidence: raw.confidence,
    x1: Math.max(0, Math.min(1, x1)), y1: Math.max(0, Math.min(1, y1)),
    x2: Math.max(0, Math.min(1, x2)), y2: Math.max(0, Math.min(1, y2)),
  };
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

  const plugin = useMemo(() => {
    try {
      const p = VisionCameraProxy.initFrameProcessorPlugin('detectObjects', {});
      if (p) console.log('[ObjectDetection] Plugin loaded');
      else console.warn('[ObjectDetection] Plugin not found');
      return p;
    } catch (e) {
      console.warn('[ObjectDetection] Failed:', e);
      return null;
    }
  }, []);

  const onDetections = useCallback((rawDets: RawDetection[]) => {
    const orientation = getOrientation();
    const transformed = rawDets.map(d => transformDetection(d, orientation));
    if (__DEV__ && transformed.length > 0 && Math.random() < 0.1) {
      console.log(`[ObjectDetection] ${transformed.length} objects: ${transformed.map(d => d.label).join(', ')}`);
    }
    setDetections(transformed);
  }, []);

  const onDetectionsWorklet = useMemo(
    () => Worklets.createRunOnJS(onDetections),
    [onDetections]
  );

  // `enabled` is passed directly into the dependency array so the frame processor
  // is recreated when it changes. Inside the worklet, we use the captured value.
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

    // `enabled` is captured in the closure when the frame processor is created
    if (!enabled || plugin == null) return;

    const frameNum = Math.floor(frame.timestamp / 33) % skipFrames;
    if (frameNum !== 0) return;

    try {
      const results = plugin.call(frame, { confidence: confidenceThreshold });
      if (results && Array.isArray(results)) {
        onDetectionsWorklet(results as unknown as RawDetection[]);
      }
    } catch {
      // ignore
    }
  }, [enabled, plugin, confidenceThreshold, skipFrames, onDetectionsWorklet]);

  return {
    detections: enabled ? detections : [],
    frameProcessor: plugin ? frameProcessor : undefined,
  };
};
