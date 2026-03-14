/**
 * Global device orientation singleton.
 *
 * One accelerometer subscription shared across the entire app.
 * Any component/hook reads the current value via getOrientation()
 * or subscribes to changes via subscribe().
 */

import { Accelerometer } from 'expo-sensors';

export type Orientation = 0 | 90 | 180 | 270;

type Listener = (orientation: Orientation) => void;

let _orientation: Orientation = 0;
let _listeners: Set<Listener> = new Set();
let _subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
let _started = false;

function _update(next: Orientation) {
  if (next === _orientation) return;
  _orientation = next;
  _listeners.forEach(fn => fn(next));
}

function _start() {
  if (_started) return;
  _started = true;
  Accelerometer.setUpdateInterval(200);
  _subscription = Accelerometer.addListener(({ x, y }) => {
    if (Math.abs(y) > Math.abs(x)) {
      if (y < -0.5) _update(0);
      else if (y > 0.5) _update(180);
    } else {
      if (x > 0.5) _update(270);
      else if (x < -0.5) _update(90);
    }
  });
}

/** Get current orientation (non-reactive). */
export function getOrientation(): Orientation {
  _start();
  return _orientation;
}

/** Subscribe to orientation changes. Returns unsubscribe function. */
export function subscribeOrientation(fn: Listener): () => void {
  _start();
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}
