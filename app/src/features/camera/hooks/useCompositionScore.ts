import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefObject } from 'react';
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraHandle } from '../../../infra/visionCamera';
import { AspectRatio } from '../types';
import { getServerUrl } from '../../../infra/network/serverUrl';

export interface CompositionResult {
  score: number;
  inference_ms: number;
  composition_score?: number;
  distribution?: number[];
  pattern_weights?: number[];
  dominant_pattern?: number;
  dominant_pattern_name?: string;
  attributes?: Record<string, number>;
}

export interface UseCompositionScoreConfig {
  cameraRef: RefObject<CameraHandle | null>;
  aspectRatio?: AspectRatio;
  serverUrl?: string;
  intervalMs?: number;
  enabled?: boolean;
}

async function processFrame(fileUri: string, ratio: AspectRatio): Promise<string> {
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(fileUri, (w, h) => resolve({ width: w, height: h }), reject);
  });

  const actions: ImageManipulator.Action[] = [];

  const isPortrait = height > width;
  let targetRatio: number;
  if (ratio === '4:3') targetRatio = isPortrait ? 4 / 3 : 3 / 4;
  else if (ratio === '16:9') targetRatio = isPortrait ? 16 / 9 : 9 / 16;
  else targetRatio = 1;

  const currentRatio = height / width;
  if (Math.abs(currentRatio - targetRatio) > 0.01) {
    let cropWidth = width;
    let cropHeight = height;
    if (currentRatio > targetRatio) cropHeight = width * targetRatio;
    else cropWidth = height / targetRatio;
    actions.push({
      crop: {
        originX: (width - cropWidth) / 2,
        originY: (height - cropHeight) / 2,
        width: cropWidth,
        height: cropHeight,
      },
    });
  }

  actions.push({ resize: { width: 640 } });

  const result = await ImageManipulator.manipulateAsync(
    fileUri, actions,
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export const useCompositionScore = ({
  cameraRef,
  aspectRatio = '4:3',
  serverUrl,
  intervalMs = 1500,
  enabled = true,
}: UseCompositionScoreConfig) => {
  // All mutable state in refs to avoid re-render loops
  const resultRef = useRef<CompositionResult | null>(null);
  const [result, setResult] = useState<CompositionResult | null>(null);
  const connectedRef = useRef(false);
  const inflightRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const aspectRatioRef = useRef(aspectRatio);
  aspectRatioRef.current = aspectRatio;
  const cameraRefRef = useRef(cameraRef);
  cameraRefRef.current = cameraRef;

  const baseUrl = useMemo(() => {
    if (serverUrl) return serverUrl;
    return getServerUrl();
  }, [serverUrl]);

  // One-time health check on mount
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    fetch(`${baseUrl}/health`, { method: 'GET', signal: controller.signal })
      .then(res => { connectedRef.current = res.ok; })
      .catch(() => { connectedRef.current = false; })
      .finally(() => clearTimeout(timer));
  }, [baseUrl]);

  // Stable interval — never restarts
  useEffect(() => {
    const analyze = async () => {
      if (__DEV__ && Math.random() < 0.2) {
        console.log(`[Composition] analyze: enabled=${enabledRef.current} camera=${!!cameraRefRef.current.current} inflight=${inflightRef.current} url=${baseUrl}`);
      }
      if (!enabledRef.current || !cameraRefRef.current.current || inflightRef.current) return;

      inflightRef.current = true;
      try {
        const path = await cameraRefRef.current.current.takePhoto('off');
        if (!path) { inflightRef.current = false; return; }

        const rawUri = path.startsWith('file://') ? path : `file://${path}`;
        const fileUri = await processFrame(rawUri, aspectRatioRef.current);
        const blob = await fetch(fileUri).then(r => r.blob());

        const response = await fetch(`${baseUrl}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });

        if (!response.ok) {
          return; // skip, finally will reset inflight
        }

        const data = await response.json();
        if (!data.skipped && !data.error) {
          resultRef.current = data as CompositionResult;
          connectedRef.current = true;
          setResult(resultRef.current);
        }
      } catch {
        // Network error (not server error) — mark disconnected
        connectedRef.current = false;
      } finally {
        inflightRef.current = false;
      }
    };

    const timeout = setTimeout(analyze, 1000);
    const interval = setInterval(analyze, intervalMs);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [baseUrl, intervalMs]);

  return { result, connected: connectedRef.current };
};
