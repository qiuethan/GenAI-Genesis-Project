/**
 * Sensor Hooks
 * 
 * Provides device sensor access (accelerometer, gyroscope, orientation)
 */

export { useDeviceOrientation } from './useDeviceOrientation';
export type { Orientation } from './useDeviceOrientation';

export { useMotionDetector } from './useMotionDetector';
export type { MotionDetectorConfig, MotionState } from './useMotionDetector';
