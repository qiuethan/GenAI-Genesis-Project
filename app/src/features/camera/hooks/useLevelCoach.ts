import { useState, useEffect, useRef } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { calculateHorizonTilt } from '../../../infra/sensors/gravityUtils';

export interface LevelCoachState {
  isLevel: boolean;
  angle: number; // in degrees
  hintText: string | null;
  isActive: boolean;
}

// Thresholds in degrees
const TILT_THRESHOLD = 2; // Show hint if tilt > 2° (allow small deadzone)
const MAX_TILT_THRESHOLD = 20; // Don't show if tilt > 20° (assume purposeful artistic angle)

export const useLevelCoach = (): LevelCoachState => {
  const [state, setState] = useState<LevelCoachState>({
    isLevel: true,
    angle: 0,
    hintText: null,
    isActive: false,
  });

  const lastUpdate = useRef<number>(0);
  const smoothedAngleRef = useRef<number>(0);

  useEffect(() => {
    // 50ms interval = 20Hz
    DeviceMotion.setUpdateInterval(50);

    const subscription = DeviceMotion.addListener(data => {
      const now = Date.now();
      if (now - lastUpdate.current < 30) return;
      lastUpdate.current = now;

      // Prefer fused gravity vector (gyro + accel), fall back to raw accel
      const gravity = data.gravity || data.accelerationIncludingGravity;
      if (!gravity) return;

      // Use utility to calculate tilt
      const { angle: rawAngleDeg, isFlat } = calculateHorizonTilt(gravity);
      
      // Ignore if device is mostly flat (pointing down/up)
      if (isFlat) {
        setState({ isLevel: true, angle: 0, hintText: null, isActive: false });
        smoothedAngleRef.current = 0; // Reset smoothing
        return;
      }

      // EMA Smoothing (Low Pass Filter)
      // 0.2 factor = responsive but smooth
      const smoothedAngle = 0.2 * rawAngleDeg + 0.8 * smoothedAngleRef.current;
      smoothedAngleRef.current = smoothedAngle;

      const absAngle = Math.abs(smoothedAngle);

      // Coaching Zone: 2° < Tilt < 20°
      const showHint = absAngle > TILT_THRESHOLD && absAngle < MAX_TILT_THRESHOLD;
      const isLevel = absAngle <= TILT_THRESHOLD;

      setState({
        isLevel,
        angle: smoothedAngle,
        hintText: showHint ? 'Level the phone' : null,
        isActive: true,
      });
    });

    return () => subscription.remove();
  }, []);

  return state;
};
