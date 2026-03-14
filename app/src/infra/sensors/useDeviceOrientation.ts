import { useState, useEffect } from 'react';
import { getOrientation, subscribeOrientation, Orientation } from './deviceOrientation';

export type { Orientation };

/**
 * React hook that returns the current device orientation.
 * Backed by a global singleton — all callers share one accelerometer subscription.
 */
export const useDeviceOrientation = (): Orientation => {
  const [orientation, setOrientation] = useState<Orientation>(getOrientation);

  useEffect(() => {
    return subscribeOrientation(setOrientation);
  }, []);

  return orientation;
};
