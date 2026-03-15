import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraDevice } from 'react-native-vision-camera';
import { useSharedValue, withSpring } from 'react-native-reanimated';
import { getZoomConfig, clampZoom } from './zoom';

const PINCH_DAMPING = 0.6;

export function useZoom(device: CameraDevice | undefined) {
  const config = getZoomConfig(device);
  const zoomShared = useSharedValue(config.neutralZoom);
  const [zoomDisplay, setZoomDisplay] = useState(config.neutralZoom);
  const [isPinching, setIsPinching] = useState(false);
  const lastScaleRef = useRef(1);
  const configRef = useRef(config);
  configRef.current = config;
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (device) {
      const newConfig = getZoomConfig(device);
      zoomShared.value = newConfig.neutralZoom;
      setZoomDisplay(newConfig.neutralZoom);
    }
  }, [device?.id]);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  const setZoom = useCallback((newZoom: number) => {
    const clamped = clampZoom(newZoom, configRef.current);
    zoomShared.value = withSpring(clamped, {
      damping: 18,
      stiffness: 140,
      mass: 0.4,
    });
    setZoomDisplay(clamped);
  }, []);

  const onPinchBegan = useCallback(() => {
    lastScaleRef.current = 1;
    setIsPinching(true);
  }, []);

  const onPinchUpdate = useCallback((gestureScale: number) => {
    const ratio = gestureScale / lastScaleRef.current;
    const dampedRatio = Math.pow(ratio, PINCH_DAMPING);
    const newZoom = clampZoom(zoomShared.value * dampedRatio, configRef.current);
    lastScaleRef.current = gestureScale;
    zoomShared.value = newZoom;

    // Throttle display sync to ~20fps (enough for UI labels)
    if (!syncTimerRef.current) {
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        setZoomDisplay(zoomShared.value);
      }, 50);
    }
  }, []);

  const onPinchEnd = useCallback(() => {
    lastScaleRef.current = 1;
    setIsPinching(false);
    setZoomDisplay(zoomShared.value);
  }, []);

  return {
    zoom: zoomDisplay,
    zoomShared,
    config,
    setZoom,
    onPinchBegan,
    onPinchUpdate,
    onPinchEnd,
    isPinching,
  };
}
