import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Image } from 'react-native';
import { DeviceMotion } from 'expo-sensors';
import * as ImageManipulator from 'expo-image-manipulator';
import { CameraHandle } from '../../../infra/visionCamera';
import { getServerUrl } from '../../../infra/network/serverUrl';
import { saveToLibrary } from '../../../infra/mediaLibrary/saveToLibrary';
import { cacheScore } from './useGalleryScores';

export interface ScanResult {
  bestScore: number;
  bestFrameUri: string;
}

const SCAN_DURATION_MS = 6000;
const TILT_THRESHOLD_DEG = 0.5;

export const useScanMode = (
  cameraRef: React.RefObject<CameraHandle | null>,
) => {
  const [isScanMode, setIsScanMode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasResult, setHasResult] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frameCount, setFrameCount] = useState(0);
  const [scoredCount, setScoredCount] = useState(0);

  // Guide overlay state
  const [guideUri, setGuideUri] = useState<string | null>(null);
  const [guideVisible, setGuideVisible] = useState(false);

  const baseUrl = useMemo(() => getServerUrl(), []);
  const cameraRefRef = useRef(cameraRef);
  cameraRefRef.current = cameraRef;

  const rawFrames = useRef<string[]>([]);
  const cancelledRef = useRef(false);
  const isCapturingRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopScanRef = useRef<(() => void) | null>(null);
  const [countdown, setCountdown] = useState(SCAN_DURATION_MS / 1000);

  // Tilt tracking refs
  const lastCaptureAngles = useRef<{ pitch: number; roll: number } | null>(null);
  const currentAngles = useRef<{ pitch: number; roll: number }>({ pitch: 0, roll: 0 });

  // Listen to DeviceMotion while scanning to track tilt
  useEffect(() => {
    if (!isScanning) return;

    DeviceMotion.setUpdateInterval(30);
    const sub = DeviceMotion.addListener(data => {
      const gravity = data.gravity || data.accelerationIncludingGravity;
      if (!gravity) return;

      const mag = Math.sqrt(gravity.x ** 2 + gravity.y ** 2 + gravity.z ** 2) || 1;
      const nx = gravity.x / mag;
      const ny = gravity.y / mag;
      const nz = gravity.z / mag;

      // pitch = tilt forward/back, roll = tilt left/right
      const pitch = Math.atan2(ny, nz) * (180 / Math.PI);
      const roll = Math.atan2(nx, nz) * (180 / Math.PI);
      currentAngles.current = { pitch, roll };

      // Capture if tilt changed enough from last capture
      const last = lastCaptureAngles.current;
      if (last && !isCapturingRef.current) {
        const dp = Math.abs(pitch - last.pitch);
        const dr = Math.abs(roll - last.roll);
        if (dp >= TILT_THRESHOLD_DEG || dr >= TILT_THRESHOLD_DEG) {
          captureFrame();
        }
      }
    });

    return () => sub.remove();
  }, [isScanning]);

  const captureFrame = useCallback(async () => {
    if (isCapturingRef.current || cancelledRef.current) return;
    isCapturingRef.current = true;

    try {
      const cam = cameraRefRef.current.current;
      if (!cam) return;
      const path = await cam.takePhoto('off');
      if (!path) return;
      const uri = path.startsWith('file://') ? path : `file://${path}`;
      rawFrames.current.push(uri);
      lastCaptureAngles.current = { ...currentAngles.current };
      setFrameCount(rawFrames.current.length);
    } catch {
      // skip
    } finally {
      isCapturingRef.current = false;
    }
  }, []);

  const enterScanMode = useCallback(() => {
    setIsScanMode(true);
    setHasResult(false);
    setResult(null);
    setError(null);
    setFrameCount(0);
    setScoredCount(0);
    setGuideUri(null);
    setGuideVisible(false);
  }, []);

  const exitScanMode = useCallback(() => {
    cancelledRef.current = true;
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setIsScanMode(false);
    setIsScanning(false);
    setIsProcessing(false);
    setHasResult(false);
    setResult(null);
    setError(null);
    setFrameCount(0);
    setScoredCount(0);
    setCountdown(SCAN_DURATION_MS / 1000);
    setGuideUri(null);
    setGuideVisible(false);
    rawFrames.current = [];
    lastCaptureAngles.current = null;
  }, []);

  const finishScanning = useCallback(async () => {
    cancelledRef.current = true;
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    setIsScanning(false);

    const frames = rawFrames.current;
    if (frames.length === 0) {
      setError('No frames captured — try moving the phone');
      return;
    }

    // Score all frames
    setIsProcessing(true);
    setScoredCount(0);

    const scored: { uri: string; score: number }[] = [];

    const scoreFrame = async (uri: string): Promise<{ uri: string; score: number } | null> => {
      try {
        const processed = await ImageManipulator.manipulateAsync(
          uri, [{ resize: { width: 320 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG },
        );
        const blob = await fetch(processed.uri).then(r => r.blob());
        const response = await fetch(`${baseUrl}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (!response.ok) return null;
        const data = await response.json();
        return { uri, score: data.score ?? 0 };
      } catch {
        return null;
      }
    };

    const BATCH_SIZE = 3;
    let count = 0;
    for (let i = 0; i < frames.length; i += BATCH_SIZE) {
      const batch = frames.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(scoreFrame));
      for (const r of results) {
        if (r) scored.push(r);
      }
      count += batch.length;
      setScoredCount(count);
    }

    setIsProcessing(false);

    if (scored.length === 0) {
      setError('No frames scored — is the server running?');
      return;
    }

    let bestIndex = 0;
    let bestScore = -1;
    for (let i = 0; i < scored.length; i++) {
      if (scored[i].score > bestScore) {
        bestScore = scored[i].score;
        bestIndex = i;
      }
    }

    setResult({ bestScore, bestFrameUri: scored[bestIndex].uri });
    setHasResult(true);
  }, [baseUrl]);

  // Store ref so the timeout can call it
  stopScanRef.current = finishScanning;

  const startScan = useCallback(async () => {
    rawFrames.current = [];
    cancelledRef.current = false;
    lastCaptureAngles.current = null;

    setIsScanning(true);
    setIsProcessing(false);
    setHasResult(false);
    setResult(null);
    setError(null);
    setFrameCount(0);
    setScoredCount(0);
    setCountdown(SCAN_DURATION_MS / 1000);

    // Auto-stop after 6 seconds
    scanTimerRef.current = setTimeout(() => {
      stopScanRef.current?.();
    }, SCAN_DURATION_MS);

    // Countdown ticker
    const startTime = Date.now();
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((SCAN_DURATION_MS - (Date.now() - startTime)) / 1000));
      setCountdown(remaining);
    }, 200);

    // Take an initial frame (non-blocking so timer/countdown start immediately)
    try {
      const cam = cameraRefRef.current.current;
      if (cam) {
        const path = await cam.takePhoto('off');
        if (path) {
          const uri = path.startsWith('file://') ? path : `file://${path}`;
          rawFrames.current.push(uri);
          lastCaptureAngles.current = { ...currentAngles.current };
          setFrameCount(1);
        }
      }
    } catch {}
  }, []);

  /** Stop scan early (manual) */
  const stopScan = useCallback(() => {
    finishScanning();
  }, [finishScanning]);

  /** Option 1: Save best photo directly to gallery (cropped to 4:3) */
  const saveBest = useCallback(async () => {
    if (!result) return;
    try {
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(result.bestFrameUri, (w, h) => resolve({ width: w, height: h }), reject);
      });

      const isPortrait = height > width;
      const targetRatio = 4 / 3;
      const desiredRatio = isPortrait ? targetRatio : 1 / targetRatio;
      const currentRatio = height / width;

      let finalUri = result.bestFrameUri;

      if (Math.abs(currentRatio - desiredRatio) > 0.01) {
        let cropWidth = width;
        let cropHeight = height;
        if (currentRatio > desiredRatio) {
          cropHeight = width * desiredRatio;
        } else {
          cropWidth = height / desiredRatio;
        }

        const cropped = await ImageManipulator.manipulateAsync(
          result.bestFrameUri,
          [{ crop: { originX: (width - cropWidth) / 2, originY: (height - cropHeight) / 2, width: cropWidth, height: cropHeight } }],
          { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
        );
        finalUri = cropped.uri;
      }

      const asset = await saveToLibrary(finalUri);
      await cacheScore(asset.id, result.bestScore);
    } catch {}
    setHasResult(false);
    setResult(null);
    // Stay in scan mode so user can scan again
  }, [result]);

  /** Option 2: Enter guide mode — show overlay on viewfinder */
  const enterGuideMode = useCallback(() => {
    if (!result) return;
    setGuideUri(result.bestFrameUri);
    setGuideVisible(true);
    setHasResult(false);
    // Exit scan mode UI but keep guide overlay
    setIsScanMode(false);
  }, [result]);

  const toggleGuide = useCallback(() => {
    setGuideVisible(v => !v);
  }, []);

  const dismissGuide = useCallback(() => {
    setGuideUri(null);
    setGuideVisible(false);
  }, []);

  return {
    isScanMode, isScanning, isProcessing, hasResult,
    result, error, frameCount, scoredCount, countdown,
    guideUri, guideVisible,
    enterScanMode, exitScanMode, startScan, stopScan,
    saveBest, enterGuideMode, toggleGuide, dismissGuide,
  };
};
