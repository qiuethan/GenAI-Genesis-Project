import { useCameraDevice, useCameraPermission, CameraDevice, CameraPosition } from 'react-native-vision-camera';

export const useSelfCameraDevice = (position: CameraPosition) => {
  const device = useCameraDevice(position, {
    physicalDevices: [
      'ultra-wide-angle-camera',
      'wide-angle-camera',
      'telephoto-camera'
    ]
  });
  return device;
};

export const useSelfCameraPermission = () => {
  return useCameraPermission();
};

export type { CameraDevice, CameraPosition };