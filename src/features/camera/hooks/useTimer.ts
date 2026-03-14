import { useState, useCallback, useRef, useEffect } from 'react';

export type TimerDuration = 0 | 3 | 10;

interface UseTimerReturn {
  timerDuration: TimerDuration;
  setTimerDuration: (duration: TimerDuration) => void;
  cycleTimer: () => void;
  isCountingDown: boolean;
  countdown: number;
  startCountdown: (onComplete: () => void) => void;
  cancelCountdown: () => void;
  getTimerIcon: () => string;
  isActive: boolean;
}

const TIMER_CYCLE: TimerDuration[] = [0, 3, 10];

/**
 * Hook to manage self-timer functionality
 * Supports off (0), 3 second, and 10 second delays
 */
export const useTimer = (): UseTimerReturn => {
  const [timerDuration, setTimerDuration] = useState<TimerDuration>(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef<(() => void) | null>(null);

  const cycleTimer = useCallback(() => {
    setTimerDuration(current => {
      const currentIndex = TIMER_CYCLE.indexOf(current);
      const nextIndex = (currentIndex + 1) % TIMER_CYCLE.length;
      return TIMER_CYCLE[nextIndex];
    });
  }, []);

  const cancelCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCountingDown(false);
    setCountdown(0);
    callbackRef.current = null;
  }, []);

  const startCountdown = useCallback((onComplete: () => void) => {
    if (timerDuration === 0) {
      onComplete();
      return;
    }

    callbackRef.current = onComplete;
    setCountdown(timerDuration);
    setIsCountingDown(true);

    intervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Store callback before clearing
          const callback = callbackRef.current;
          
          // Clear interval and state
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsCountingDown(false);
          callbackRef.current = null;
          
          // Execute callback after clearing (Apple-style: take photo at 0)
          if (callback) {
            callback();
          }
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timerDuration]);

  const getTimerIcon = useCallback((): string => {
    return 'timer';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    timerDuration,
    setTimerDuration,
    cycleTimer,
    isCountingDown,
    countdown,
    startCountdown,
    cancelCountdown,
    getTimerIcon,
    isActive: timerDuration > 0,
  };
};
