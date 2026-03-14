/**
 * Shared rotation types
 * Single source of truth for device orientation/rotation values
 */

export type DeviceRotation = 0 | 90 | 180 | 270;

/**
 * Maps device orientation to UI rotation
 * Used consistently across all rotatable components
 */
export const getUIRotation = (orientation: DeviceRotation): DeviceRotation => {
  return orientation;
};
