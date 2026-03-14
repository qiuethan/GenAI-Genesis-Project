/**
 * Sensor Hooks
 * 
 * Provides device sensor access (accelerometer, gyroscope, orientation)
 */

export { useDeviceOrientation } from './useDeviceOrientation';
export type { Orientation } from './useDeviceOrientation';
export { getOrientation, subscribeOrientation } from './deviceOrientation';

export { useMotionDetector } from './useMotionDetector';
export type { MotionDetectorConfig, MotionState } from './useMotionDetector';
