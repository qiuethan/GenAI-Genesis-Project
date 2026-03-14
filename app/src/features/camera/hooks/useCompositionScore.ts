import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { RefObject } from 'react';
import { Image, NativeModules } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraHandle } from '../../../infra/visionCamera';
import { AspectRatio } from '../types';

export interface CompositionResult {
  score: number;
  distribution: number[];
  label: string;
  inference_ms: number;
}

export interface UseCompositionScoreConfig {
  cameraRef: RefObject<CameraHandle | null>;
  aspectRatio?: AspectRatio;
  serverUrl?: string;
  port?: number;
  intervalMs?: number;
  enabled?: boolean;
}

const COMPOSITION_PORT = 8420;

function getDevServerHost(): string | null {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL as string | undefined;
    if (scriptURL) {
      const match = scriptURL.match(/^https?:\/\/([^:\/]+)/);
      if (match && match[1] !== 'localhost' && match[1] !== '127.0.0.1') return match[1];
      if (match) return match[1];
    }
  } catch {}
  return null;
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
  port = COMPOSITION_PORT,
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
    const host = getDevServerHost() ?? '10.0.0.151';
    return `http://${host}:${port}`;
  }, [serverUrl, port]);

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

        if (!response.ok) throw new Error(`${response.status}`);

        const data = await response.json();
        if (!data.skipped) {
          resultRef.current = data as CompositionResult;
          connectedRef.current = true;
          setResult(resultRef.current);
        }
      } catch {
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
