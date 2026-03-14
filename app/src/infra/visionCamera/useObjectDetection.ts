/**
 * On-device YOLO object detection via CoreML frame processor plugin.
 * Returns detections with coordinates transformed for the current device orientation.
 */

import { useCallback, useState, useMemo } from 'react';
import { useFrameProcessor } from 'react-native-vision-camera';
import { VisionCameraProxy } from 'react-native-vision-camera';
import { Worklets } from 'react-native-worklets-core';
import { getOrientation } from '../sensors/deviceOrientation';

export interface Detection {
  label: string;
  confidence: number;
  x1: number;  // normalized 0-1, in DISPLAY coordinates (orientation-corrected)
  y1: number;
  x2: number;
  y2: number;
}

/** Raw detection from native plugin (landscape buffer coords) */
interface RawDetection {
  label: string;
  confidence: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Transform landscape buffer coords to display coords based on device orientation.
 *
 * Camera always outputs landscape buffer (1920x1080).
 * - Portrait (0°): buffer is rotated 90° CW from display → (x,y) → (1-y, x)
 * - Landscape right (90°): buffer matches display → no transform
 * - Upside down (180°): buffer is rotated 90° CCW → (x,y) → (y, 1-x)
 * - Landscape left (270°): buffer is flipped → (x,y) → (1-x, 1-y)
 */
function transformDetection(raw: RawDetection, orientation: number): Detection {
  let x1: number, y1: number, x2: number, y2: number;

  switch (orientation) {
    case 0: // Portrait: rotate 90° CW
      x1 = 1 - raw.y2;
      y1 = raw.x1;
      x2 = 1 - raw.y1;
      y2 = raw.x2;
      break;
    case 90: // Landscape right: no transform
      x1 = raw.x1;
      y1 = raw.y1;
      x2 = raw.x2;
      y2 = raw.y2;
      break;
    case 180: // Upside down: rotate 90° CCW
      x1 = raw.y1;
      y1 = 1 - raw.x2;
      x2 = raw.y2;
      y2 = 1 - raw.x1;
      break;
    case 270: // Landscape left: flip both
      x1 = 1 - raw.x2;
      y1 = 1 - raw.y2;
      x2 = 1 - raw.x1;
      y2 = 1 - raw.y1;
      break;
    default: // Fallback: portrait
      x1 = 1 - raw.y2;
      y1 = raw.x1;
      x2 = 1 - raw.y1;
      y2 = raw.x2;
  }

  return {
    label: raw.label,
    confidence: raw.confidence,
    x1: Math.max(0, Math.min(1, x1)),
    y1: Math.max(0, Math.min(1, y1)),
    x2: Math.max(0, Math.min(1, x2)),
    y2: Math.max(0, Math.min(1, y2)),
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
    if (!enabled) return null;
    try {
      const p = VisionCameraProxy.initFrameProcessorPlugin('detectObjects', {});
      if (p == null) {
        console.warn('[ObjectDetection] Plugin not found');
      } else {
        console.log('[ObjectDetection] Plugin loaded');
      }
      return p;
    } catch (e) {
      console.warn('[ObjectDetection] Failed to init plugin:', e);
      return null;
    }
  }, [enabled]);

  const onDetections = useCallback((rawDets: RawDetection[]) => {
    // Transform coords from landscape buffer space to display space
    const orientation = getOrientation();
    const transformed = rawDets.map(d => transformDetection(d, orientation));
    setDetections(transformed);
  }, []);

  const onDetectionsWorklet = useMemo(
    () => Worklets.createRunOnJS(onDetections),
    [onDetections]
  );

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';

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
    detections,
    frameProcessor: enabled ? frameProcessor : undefined,
  };
};
