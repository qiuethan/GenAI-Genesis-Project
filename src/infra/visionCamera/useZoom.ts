import { useState, useEffect, useRef, useCallback } from 'react';
import { CameraDevice } from 'react-native-vision-camera';
import { getZoomConfig, clampZoom, applyIncrementalPinchZoom, smoothZoom, shouldSuppressJitter } from './zoom';

export function useZoom(device: CameraDevice | undefined) {
  const config = getZoomConfig(device);
  const [zoomTarget, setZoomTarget] = useState(config.neutralZoom);
  const [zoomSmoothed, setZoomSmoothed] = useState(config.neutralZoom);
  const [isPinching, setIsPinching] = useState(false);
  
  const zoomTargetRef = useRef(zoomTarget);
  const zoomSmoothedRef = useRef(zoomSmoothed);
  const lastScaleRef = useRef(1);

  useEffect(() => {
    zoomTargetRef.current = zoomTarget;
  }, [zoomTarget]);

  useEffect(() => {
    zoomSmoothedRef.current = zoomSmoothed;
  }, [zoomSmoothed]);

  useEffect(() => {
    if (device) {
      const newConfig = getZoomConfig(device);
      setZoomTarget(newConfig.neutralZoom);
      setZoomSmoothed(newConfig.neutralZoom);
    }
  }, [device?.id]);

  useEffect(() => {
    let rafId: number | null = null;
    let isActive = true;
    
    const animate = () => {
      if (!isActive) return;
      
      const current = zoomSmoothedRef.current;
      const target = zoomTargetRef.current;
      
      if (shouldSuppressJitter(target, current, config.neutralZoom)) {
        rafId = null;
        return;
      }

      const newSmoothed = smoothZoom(current, target, 0.3);
      
      if (Math.abs(newSmoothed - current) > 0.001) {
        setZoomSmoothed(newSmoothed);
        if (isActive) {
          rafId = requestAnimationFrame(animate);
        }
      } else {
        rafId = null;
      }
    };
    
    rafId = requestAnimationFrame(animate);
    
    return () => {
      isActive = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [zoomTarget, config.neutralZoom]);

  const setZoomValue = useCallback((newZoom: number) => {
    const clamped = clampZoom(newZoom, config);
    setZoomTarget(clamped);
  }, [config]);

  const onPinchBegan = useCallback(() => {
    lastScaleRef.current = 1;
    setIsPinching(true);
  }, []);

  const onPinchUpdate = useCallback((gestureScale: number) => {
    const newZoom = applyIncrementalPinchZoom(
      zoomTargetRef.current,
      gestureScale,
      lastScaleRef.current,
      config
    );
    
    lastScaleRef.current = gestureScale;
    
    if (Math.abs(newZoom - zoomTargetRef.current) > 0.001) {
      setZoomTarget(newZoom);
    }
  }, [config]);

  const onPinchEnd = useCallback(() => {
    lastScaleRef.current = 1;
    setIsPinching(false);
  }, []);

  return {
    zoom: zoomSmoothed,
    config,
    setZoom: setZoomValue,
    onPinchBegan,
    onPinchUpdate,
    onPinchEnd,
    isPinching,
  };
}
