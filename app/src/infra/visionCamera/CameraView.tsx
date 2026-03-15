import { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, CameraDevice, ReadonlyFrameProcessor } from 'react-native-vision-camera';
import Reanimated, { useAnimatedProps, SharedValue } from 'react-native-reanimated';

const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);

export interface CameraHandle {
  takePhoto: (flash: 'off' | 'on' | 'auto') => Promise<string>;
  takeSnapshot: () => Promise<string>;
  focus: (point: { x: number; y: number }) => Promise<void>;
}

interface Props {
  device: CameraDevice | undefined;
  isActive: boolean;
  zoom?: SharedValue<number>;
  torch?: 'off' | 'on';
  exposure?: number;
  lowLightBoost?: boolean;
  frameProcessor?: ReadonlyFrameProcessor;
}

export const CameraView = forwardRef<CameraHandle, Props>(({ device, isActive, zoom, torch = 'off', exposure = 0, lowLightBoost = false, frameProcessor }, ref) => {
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

  const animatedProps = useAnimatedProps(() => ({
    zoom: zoom?.value ?? 1,
  }));

  if (!device) return null;

  const maxRange = Math.min(device?.maxExposure ?? 2, 2);
  const mappedExposure = exposure * maxRange * 0.5;

  return (
    <ReanimatedCamera
      ref={camera}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      photo={true}
      video={true}
      animatedProps={animatedProps}
      torch={torch}
      exposure={mappedExposure}
      lowLightBoost={lowLightBoost && device?.supportsLowLightBoost}
      frameProcessor={frameProcessor}
    />
  );
});
