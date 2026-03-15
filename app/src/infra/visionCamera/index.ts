export { CameraView } from './CameraView';
export type { CameraHandle } from './CameraView';

export { useSelfCameraDevice, useSelfCameraPermission } from './getCameraDevice';
export type { CameraDevice, CameraPosition } from './getCameraDevice';

export { takePhoto } from './takePhoto';
export type { FlashMode } from './takePhoto';

export { useZoom } from './useZoom';

export {
  getZoomConfig,
  clampZoom,
  formatZoomDisplay,
} from './zoom';
export type { ZoomConfig, ZoomStop } from './zoom';

export { useBlurFrameProcessor } from './useBlurFrameProcessor';
export { useAnalysisFrameProcessor } from './useAnalysisFrameProcessor';
export { useExposureFrameProcessor } from './useExposureFrameProcessor';
export { useObjectDetection } from './useObjectDetection';
export type { Detection } from './useObjectDetection';
