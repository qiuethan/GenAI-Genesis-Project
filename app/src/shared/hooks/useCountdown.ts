import { useEffect, useState } from 'react';

interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  formatted: string;
}

export function useCountdown(targetDate: string | undefined): CountdownResult {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!targetDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, formatted: '00:00:00' };
  }

  const target = new Date(targetDate).getTime();
  const diff = Math.max(0, target - now);
  const isExpired = diff === 0;

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return { days, hours, minutes, seconds, isExpired, formatted };
}
