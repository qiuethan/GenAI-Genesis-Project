import { useState, useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';

export type Orientation = 0 | 90 | 180 | 270;

export const useDeviceOrientation = () => {
  const [orientation, setOrientation] = useState<Orientation>(0);

  useEffect(() => {
    Accelerometer.setUpdateInterval(500);

    const subscription = Accelerometer.addListener(data => {
      const { x, y } = data;

      if (Math.abs(y) > Math.abs(x)) {
        // Invert Y logic based on user feedback (likely Android or specific behavior)
        // If Y is negative, it's Portrait (Gravity towards bottom, but axis points up?)
        // Let's try: y < -0.5 -> 0 (Portrait)
        if (y < -0.5) {
            setOrientation(0); 
        } else if (y > 0.5) {
            setOrientation(180);
        }
      } else {
        if (x > 0.5) {
            setOrientation(270); // Landscape Left
        } else if (x < -0.5) {
            setOrientation(90); // Landscape Right
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return orientation;
};
