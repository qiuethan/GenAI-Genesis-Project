/**
 * Camera Overlay Components
 * 
 * Shared styling and components for camera overlays following SOLID principles:
 * - Single Responsibility: Each component has one job
 * - Open/Closed: Extend via props, not modification
 * - Liskov Substitution: All hints use same base interface
 * - Interface Segregation: Small, focused interfaces
 * - Dependency Inversion: Components depend on abstractions (props), not concrete implementations
 */

export { CoachingHint } from './CoachingHint';
export { overlayStyles, OVERLAY_COLORS } from './styles';
export type { CoachingHintProps } from './CoachingHint';
