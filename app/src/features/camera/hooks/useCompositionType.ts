import { useState, useEffect, useRef, useMemo } from 'react';
import { RefObject } from 'react';
import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraHandle } from '../../../infra/visionCamera';
import { AspectRatio } from '../types';
import { getServerUrl } from '../../../infra/network/serverUrl';

export interface UseCompositionTypeConfig {
  cameraRef: RefObject<CameraHandle | null>;
  aspectRatio?: AspectRatio;
  enabled?: boolean;
  intervalMs?: number;
}

const DISPLAY_NAMES: Record<string, string> = {
  rule_of_thirds: 'Rule of Thirds',
  symmetry: 'Symmetry',
  leading_lines: 'Leading Lines',
  diagonals: 'Diagonals',
  triangles: 'Triangles',
  golden_ratio: 'Golden Ratio',
  negative_space: 'Negative Space',
  foreground_interest: 'Foreground Interest',
  layering: 'Layering',
  patterns: 'Patterns',
  framing: 'Framing',
};

export const useCompositionType = ({
  cameraRef,
  aspectRatio = '4:3',
  enabled = true,
  intervalMs = 5000,
}: UseCompositionTypeConfig) => {
  const [compositionType, setCompositionType] = useState<string | null>(null);
  const inflightRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const cameraRefRef = useRef(cameraRef);
  cameraRefRef.current = cameraRef;
  const aspectRatioRef = useRef(aspectRatio);
  aspectRatioRef.current = aspectRatio;

  const baseUrl = useMemo(() => getServerUrl(), []);

  useEffect(() => {
    const classify = async () => {
      if (!enabledRef.current || !cameraRefRef.current.current || inflightRef.current) return;

      inflightRef.current = true;
      try {
        const path = await cameraRefRef.current.current.takePhoto('off');
        if (!path) { inflightRef.current = false; return; }

        const rawUri = path.startsWith('file://') ? path : `file://${path}`;

        // Resize smaller than scoring — classification doesn't need high res
        const processed = await ImageManipulator.manipulateAsync(
          rawUri,
          [{ resize: { width: 480 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
        );

        const blob = await fetch(processed.uri).then(r => r.blob());
        const response = await fetch(`${baseUrl}/classify-composition`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.composition_type) {
          setCompositionType(data.composition_type);
        }
      } catch {
        // Network error — skip silently
      } finally {
        inflightRef.current = false;
      }
    };

    const timeout = setTimeout(classify, 2000); // first classify after 2s
    const interval = setInterval(classify, intervalMs);
    return () => { clearTimeout(timeout); clearInterval(interval); };
  }, [baseUrl, intervalMs]);

  const displayName = compositionType ? (DISPLAY_NAMES[compositionType] ?? compositionType) : null;

  return { compositionType, displayName };
};
