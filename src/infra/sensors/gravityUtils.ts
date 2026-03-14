/**
 * Gravity Vector Utilities
 * 
 * Helper functions for processing gravity sensor data.
 */

export interface GravityVector {
  x: number;
  y: number;
  z: number;
}

export interface HorizonTiltResult {
  /** The tilt angle in degrees relative to the horizon */
  angle: number;
  /** Whether the device is effectively flat (pointing up/down) */
  isFlat: boolean;
  /** The dominant axis detected (X for Portrait, Y for Landscape) */
  dominantAxis: 'x' | 'y';
}

/**
 * Calculates the horizon tilt angle from a raw gravity vector.
 * Handles normalization and dominant axis detection.
 * 
 * @param rawGravity The raw gravity vector (m/s^2 or Gs)
 * @param flatThreshold Threshold for Z-axis to consider device flat (default 0.8)
 * @returns HorizonTiltResult
 */
export const calculateHorizonTilt = (
  rawGravity: GravityVector, 
  flatThreshold = 0.8
): HorizonTiltResult => {
  const { x: rawX, y: rawY, z: rawZ } = rawGravity;
  
  // Normalize gravity vector (convert to unit vector)
  const magnitude = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ) || 1;
  const x = rawX / magnitude;
  const y = rawY / magnitude;
  const z = rawZ / magnitude;
  
  // Check if device is flat (pointing down/up)
  const isFlat = Math.abs(z) > flatThreshold;
  
  if (isFlat) {
    return { angle: 0, isFlat: true, dominantAxis: 'x' }; // Axis doesn't matter when flat
  }

  // Automatically determine orientation based on gravity vector
  // If |y| > |x|, gravity is mostly along Y (Portrait). Leveling means minimizing X.
  // If |x| > |y|, gravity is mostly along X (Landscape). Leveling means minimizing Y.
  let tiltAxisValue = 0;
  let dominantAxis: 'x' | 'y' = 'y';

  if (Math.abs(y) > Math.abs(x)) {
    // Portrait-ish
    tiltAxisValue = x;
    dominantAxis = 'y'; // Main axis is Y, so we tilt around it? No, tilt is cross-axis.
                        // But dominant gravity is Y.
  } else {
    // Landscape-ish
    tiltAxisValue = y;
    dominantAxis = 'x';
  }

  // Calculate angle
  // value = sin(angle) * g (approx 1 for normalized gravity)
  // Clamp to -1..1 to avoid NaN from sensor noise
  const angleRad = Math.asin(Math.max(-1, Math.min(1, tiltAxisValue)));
  const angleDeg = (angleRad * 180) / Math.PI;

  return {
    angle: angleDeg,
    isFlat: false,
    dominantAxis
  };
};
