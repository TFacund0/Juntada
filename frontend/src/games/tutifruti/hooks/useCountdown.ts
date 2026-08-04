import { useState, useEffect } from "react";

export function useCountdown(timerEnd: number | null): number | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timerEnd) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [timerEnd]);
  if (!timerEnd) return null;
  return Math.max(0, Math.ceil((timerEnd - now) / 1000));
}
