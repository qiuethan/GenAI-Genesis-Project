/**
 * Camera Feature Hooks
 * Custom hooks for camera feature business logic
 */

export { useGallery } from './useGallery';
export { useFlash } from './useFlash';
export { useTimer } from './useTimer';
export type { TimerDuration } from './useTimer';
export { useNightMode } from './useNightMode';
export type { NightModeState } from './useNightMode';
export { useExposure } from './useExposure';
export type { ExposureValue } from './useExposure';
export { useColorFilter } from './useColorFilter';
export type { ColorFilterType } from './useColorFilter';
export { useFocus } from './useFocus';
export type { FocusPoint } from './useFocus';
export { useBlurCoach } from './useBlurCoach';
export { useShakeCoach } from './useShakeCoach';
export { useLevelCoach } from './useLevelCoach';
export { useExposureCoach } from './useExposureCoach';
export type { BlurCoachState, BlurCoachConfig, UseBlurCoachReturn } from './useBlurCoach';
export { useGalleryScores, scorePhoto, cacheScore } from './useGalleryScores';
export type { GalleryScore } from './useGalleryScores';
export { useCompositionScore } from './useCompositionScore';
export type { CompositionResult, UseCompositionScoreConfig } from './useCompositionScore';
export { useScanMode } from './useScanMode';
export type { ScanResult } from './useScanMode';
