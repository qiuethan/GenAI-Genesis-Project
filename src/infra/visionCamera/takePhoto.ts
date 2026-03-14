import { RefObject } from 'react';
import { CameraHandle } from './CameraView';

export type FlashMode = 'off' | 'on' | 'auto' | 'torch';

export const takePhoto = async (
  cameraRef: RefObject<CameraHandle | null>, 
  flash: FlashMode = 'off',
  sceneBrightness?: number
): Promise<string | undefined> => {
  if (!cameraRef.current) {
    console.warn("Camera ref is not ready");
    return undefined;
  }
  try {
    let actualFlash: 'off' | 'on' | 'auto' = 'off';
    
    if (flash === 'torch') {
      actualFlash = 'off';
    } else if (flash === 'auto') {
      if (sceneBrightness !== undefined && sceneBrightness < 0.3) {
        actualFlash = 'on';
      } else {
        actualFlash = 'auto';
      }
    } else {
      actualFlash = flash;
    }
    
    const path = await cameraRef.current.takePhoto(actualFlash);
    return path;
  } catch (e) {
    console.error("Failed to take photo", e);
    return undefined;
  }
};