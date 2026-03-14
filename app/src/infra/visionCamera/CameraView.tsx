import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, CameraDevice, useCameraDevice, useCameraPermission, ReadonlyFrameProcessor } from 'react-native-vision-camera';

export interface CameraHandle {
  takePhoto: (flash: 'off' | 'on' | 'auto') => Promise<string>; // Returns path
  takeSnapshot: () => Promise<string>; // Returns path — captures what's on screen
  focus: (point: { x: number; y: number }) => Promise<void>;
}

interface Props {
  device: CameraDevice | undefined;
  isActive: boolean;
  zoom?: number;
  torch?: 'off' | 'on';
  exposure?: number; // -1 to 1 range (will be mapped to device range)
  lowLightBoost?: boolean;
  frameProcessor?: ReadonlyFrameProcessor;
}

export const CameraView = forwardRef<CameraHandle, Props>(({ device, isActive, zoom = 1.0, torch = 'off', exposure = 0, lowLightBoost = false, frameProcessor }, ref) => {
  const camera = useRef<Camera>(null);

  useImperativeHandle(ref, () => ({
    takePhoto: async (flash) => {
      if (!camera.current) throw new Error("Camera ref is null");
      const photo = await camera.current.takePhoto({
        flash: flash
      });
      return photo.path;
    },
    takeSnapshot: async () => {
      if (!camera.current) throw new Error("Camera ref is null");
      const snapshot = await camera.current.takeSnapshot({ quality: 50 });
      return snapshot.path;
    },
    focus: async (point) => {
      if (!camera.current) throw new Error("Camera ref is null");
      await camera.current.focus(point);
    }
  }));

  if (!device) return null;

  // Map exposure from -1 to 1 range to a reasonable portion of device's exposure range
  // Using 25% of max to prevent extreme over/under exposure
  const maxRange = Math.min(device?.maxExposure ?? 2, 2);
  const mappedExposure = exposure * maxRange * 0.5;

  return (
    <Camera
      ref={camera}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      photo={true}
      video={true}
      zoom={zoom}
      torch={torch}
      exposure={mappedExposure}
      lowLightBoost={lowLightBoost && device?.supportsLowLightBoost}
      frameProcessor={frameProcessor}
    />
  );
});