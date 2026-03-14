import { useState, useRef, useCallback, useMemo } from 'react';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraHandle } from '../../../infra/visionCamera';
import type { Detection } from '../../../infra/visionCamera';
import { getServerUrl } from '../../../infra/network/serverUrl';

export interface SelectedObject {
  id: string;
  label: string;
  box_norm: [number, number, number, number];
}

export interface ScanResult {
  bestIndex: number;
  bestScore: number;
  bestFrameUri: string;
}

export type { Detection as DetectedObject };

const SCAN_DURATION_MS = 6000;
const CAPTURE_INTERVAL_MS = 500;

/**
 * Scan mode hook.
 *
 * Object detection runs ON DEVICE via CoreML (passed in as `detections` from
 * the useObjectDetection frame processor). This hook manages selection state,
 * scan timing, and server scoring.
 */
export const useScanMode = (
  cameraRef: React.RefObject<CameraHandle | null>,
) => {
  const [selectedObjects, setSelectedObjects] = useState<SelectedObject[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = useMemo(() => getServerUrl(), []);
  const cameraRefRef = useRef(cameraRef);
  cameraRefRef.current = cameraRef;
  const selectedRef = useRef<SelectedObject[]>([]);
  const capturedFrames = useRef<{ uri: string; score: number; valid: boolean }[]>([]);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Enter selection mode — on-device YOLO will start drawing boxes */
  const startSelecting = useCallback(() => {
    setIsSelecting(true);
    setIsScanning(false);
    setHasResult(false);
    setSelectedObjects([]);
    setResult(null);
    setError(null);
    selectedRef.current = [];
    capturedFrames.current = [];
  }, []);

  /**
   * User taps screen at (nx, ny) normalized 0-1 relative to camera frame.
   * Find which YOLO detection contains that point and select/deselect it.
   * `currentDetections` is the latest on-device YOLO detections array.
   */
  const tapToSelect = useCallback((nx: number, ny: number, currentDetections: Detection[]) => {
    // Find detection whose box contains the tap point
    const tapped = currentDetections.find(d =>
      nx >= d.x1 && nx <= d.x2 && ny >= d.y1 && ny <= d.y2
    );
    if (!tapped) return; // tap didn't hit any object

    // Check if already selected — deselect
    const existing = selectedRef.current.find(s =>
      s.label === tapped.label &&
      Math.abs((s.box_norm[0] + s.box_norm[2]) / 2 - (tapped.x1 + tapped.x2) / 2) < 0.2
    );
    let next: SelectedObject[];
    if (existing) {
      next = selectedRef.current.filter(s => s.id !== existing.id);
    } else {
      next = [...selectedRef.current, {
        id: `sel_${Date.now()}`,
        label: tapped.label,
        box_norm: [tapped.x1, tapped.y1, tapped.x2, tapped.y2],
      }];
    }
    selectedRef.current = next;
    setSelectedObjects([...next]);
  }, []);

  /** User taps a detected object to select/deselect it (direct object reference) */
  const toggleObject = useCallback((det: Detection) => {
    const existing = selectedRef.current.find(s =>
      s.label === det.label &&
      Math.abs((s.box_norm[0] + s.box_norm[2]) / 2 - (det.x1 + det.x2) / 2) < 0.15
    );
    let next: SelectedObject[];
    if (existing) {
      next = selectedRef.current.filter(s => s.id !== existing.id);
    } else {
      next = [...selectedRef.current, {
        id: `sel_${Date.now()}`,
        label: det.label,
        box_norm: [det.x1, det.y1, det.x2, det.y2],
      }];
    }
    selectedRef.current = next;
    setSelectedObjects([...next]);
  }, []);

  /**
   * Check if all selected objects are still in frame based on current detections.
   * Called from the component with latest on-device detections.
   */
  const checkObjectsInFrame = useCallback((detections: Detection[]): boolean => {
    const margin = 0.03;
    for (const sel of selectedRef.current) {
      const match = detections.find(d =>
        d.label === sel.label &&
        Math.abs((d.x1 + d.x2) / 2 - (sel.box_norm[0] + sel.box_norm[2]) / 2) < 0.3
      );
      if (!match) return false;
      // Check not cut off at edges
      if (match.x1 < margin || match.y1 < margin ||
          match.x2 > 1 - margin || match.y2 > 1 - margin) return false;
      // Update tracked position
      sel.box_norm = [match.x1, match.y1, match.x2, match.y2];
    }
    return true;
  }, []);

  const finishScan = useCallback(() => {
    setIsScanning(false);
    setProgress(1);

    const frames = capturedFrames.current;
    if (frames.length === 0) {
      setError('No frames captured');
      return;
    }

    let bestIndex = 0;
    let bestScore = -1;
    const valid = frames.map((f, i) => ({ ...f, i })).filter(f => f.valid);
    const candidates = valid.length > 0 ? valid : frames.map((f, i) => ({ ...f, i }));
    for (const f of candidates) {
      if (f.score > bestScore) {
        bestScore = f.score;
        bestIndex = f.i;
      }
    }

    setResult({ bestIndex, bestScore, bestFrameUri: frames[bestIndex].uri });
    setHasResult(true);
  }, []);

  /** Start the scan — captures frames and scores them on the server */
  const startScan = useCallback(async () => {
    if (selectedRef.current.length === 0) return;

    capturedFrames.current = [];
    const startTime = Date.now();

    setIsSelecting(false);
    setIsScanning(true);
    setProgress(0);
    setError(null);

    scanTimerRef.current = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min(1, elapsed / SCAN_DURATION_MS));

      if (elapsed >= SCAN_DURATION_MS) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        scanTimerRef.current = null;
        finishScan();
        return;
      }

      try {
        const cam = cameraRefRef.current.current;
        if (!cam) return;
        const path = await cam.takePhoto('off');
        if (!path) return;
        const uri = path.startsWith('file://') ? path : `file://${path}`;

        // Send to server for TANet scoring only (no YOLO on server)
        const processed = await ImageManipulator.manipulateAsync(
          uri, [{ resize: { width: 640 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
        );
        const blob = await fetch(processed.uri).then(r => r.blob());
        const response = await fetch(`${baseUrl}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });

        if (!response.ok) return;
        const data = await response.json();

        // Object tracking is done on-device — we just need to know if they're still visible
        // The checkObjectsInFrame function is called from the component with live detections
        capturedFrames.current.push({
          uri,
          score: data.aesthetic_score ?? data.score ?? 0,
          valid: true, // will be updated by component via markLastFrameValid
        });
      } catch {
        // skip
      }
    }, CAPTURE_INTERVAL_MS);
  }, [baseUrl, finishScan]);

  /** Called by component to mark latest frame's validity based on on-device detection */
  const markLastFrameValid = useCallback((valid: boolean) => {
    const frames = capturedFrames.current;
    if (frames.length > 0) {
      frames[frames.length - 1].valid = valid;
    }
  }, []);

  const cancel = useCallback(() => {
    if (scanTimerRef.current) { clearInterval(scanTimerRef.current); scanTimerRef.current = null; }
    setIsSelecting(false);
    setIsScanning(false);
    setHasResult(false);
    setSelectedObjects([]);
    setProgress(0);
    setResult(null);
    setError(null);
    selectedRef.current = [];
    capturedFrames.current = [];
  }, []);

  return {
    selectedObjects,
    isSelecting, isScanning, hasResult,
    progress, result, error,
    startSelecting, tapToSelect, toggleObject, checkObjectsInFrame, markLastFrameValid,
    startScan, cancel,
  };
};
