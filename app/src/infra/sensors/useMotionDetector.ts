import { useState, useEffect, useRef } from 'react';
import { Accelerometer, Gyroscope } from 'expo-sensors';

/**
 * Motion Detector Hook
 * 
 * Detects device shake/motion that would cause motion blur in photos.
 * Uses accelerometer for linear motion and gyroscope for rotation.
 */

export interface MotionDetectorConfig {
  /** Update interval in ms (default: 50ms = 20Hz) */
  updateInterval?: number;
  /** EMA smoothing factor 0-1 (default: 0.3) */
  smoothingFactor?: number;
  /** Enable gyroscope in addition to accelerometer (default: true) */
  useGyroscope?: boolean;
}

export interface MotionState {
  /** Smoothed motion magnitude 0-1 */
  magnitude: number;
  /** Is device currently shaking enough to cause blur */
  isShaking: boolean;
  /** Raw accelerometer magnitude */
  accelMagnitude: number;
  /** Raw gyroscope magnitude (rotation speed) */
  gyroMagnitude: number;
}

// Thresholds tuned for handheld photography (extremely sensitive)
const SHAKE_THRESHOLD = 0.06;  // 6% magnitude triggers shake
const STEADY_THRESHOLD = 0.04; // 4% magnitude clears shake
const ACCEL_SCALE = 2.0;
const GYRO_SCALE = 3.0;

const DEFAULT_CONFIG: Required<MotionDetectorConfig> = {
  updateInterval: 50,
  smoothingFactor: 0.3,
  useGyroscope: true,
};

export const useMotionDetector = (config?: MotionDetectorConfig): MotionState => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<MotionState>({
    magnitude: 0,
    isShaking: false,
    accelMagnitude: 0,
    gyroMagnitude: 0,
  });

  // Use refs to store mutable values that don't trigger re-renders
  const stateRef = useRef({
    accel: { x: 0, y: 0, z: 0 },
    prevAccel: { x: 0, y: 0, z: 0 },
    gyro: { x: 0, y: 0, z: 0 },
    smoothedMagnitude: 0,
    isShaking: false,
    _lastUpdate: 0,
  });

  useEffect(() => {
    Accelerometer.setUpdateInterval(cfg.updateInterval);
    if (cfg.useGyroscope) {
      Gyroscope.setUpdateInterval(cfg.updateInterval);
    }

    const computeAndUpdate = () => {
      const s = stateRef.current;
      
      // Compute acceleration delta (removes gravity bias)
      const dx = s.accel.x - s.prevAccel.x;
      const dy = s.accel.y - s.prevAccel.y;
      const dz = s.accel.z - s.prevAccel.z;
      
      const accelDelta = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const normalizedAccel = Math.min(1, accelDelta / ACCEL_SCALE);

      const gyroMag = Math.sqrt(s.gyro.x * s.gyro.x + s.gyro.y * s.gyro.y + s.gyro.z * s.gyro.z);
      const normalizedGyro = cfg.useGyroscope ? Math.min(1, gyroMag / GYRO_SCALE) : 0;

      const rawMagnitude = cfg.useGyroscope
        ? normalizedAccel * 0.4 + normalizedGyro * 0.6
        : normalizedAccel;

      // EMA smoothing
      s.smoothedMagnitude = cfg.smoothingFactor * rawMagnitude + 
                           (1 - cfg.smoothingFactor) * s.smoothedMagnitude;

      // Hysteresis
      if (!s.isShaking && s.smoothedMagnitude > SHAKE_THRESHOLD) {
        s.isShaking = true;
      } else if (s.isShaking && s.smoothedMagnitude < STEADY_THRESHOLD) {
        s.isShaking = false;
      }

      s.prevAccel = { ...s.accel };

      // Throttle setState to avoid max update depth
      const now = Date.now();
      if (!s._lastUpdate || now - s._lastUpdate > 100) {
        s._lastUpdate = now;
        setState({
          magnitude: s.smoothedMagnitude,
          isShaking: s.isShaking,
          accelMagnitude: normalizedAccel,
          gyroMagnitude: normalizedGyro,
        });
      }
    };

    const accelSub = Accelerometer.addListener(data => {
      stateRef.current.accel = data;
      computeAndUpdate();
    });

    let gyroSub: { remove: () => void } | null = null;
    if (cfg.useGyroscope) {
      gyroSub = Gyroscope.addListener(data => {
        stateRef.current.gyro = data;
      });
    }

    return () => {
      accelSub.remove();
      gyroSub?.remove();
    };
  }, [cfg.updateInterval, cfg.useGyroscope, cfg.smoothingFactor]);

  return state;
};
