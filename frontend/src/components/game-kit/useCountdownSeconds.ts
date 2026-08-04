import { useEffect, useRef, useState } from "react";

/**
 * Ticks its own countdown from a server-owned end timestamp every 500ms —
 * shared by any timer (bar or ring) that only has `timerEnd`, not a locally
 * ticked seconds count. Originally lived inside impostor's RingTimer, moved
 * here once rayado-libre needed the same tick logic for its own circular
 * timer instead of duplicating it.
 */
export function useCountdownSeconds(timerEnd: number, total?: number): { secs: number; total: number } {
  const [secs, setSecs] = useState(0);
  const totalRef = useRef(total || 1);

  useEffect(() => {
    totalRef.current = total || Math.max(1, Math.ceil((timerEnd - Date.now()) / 1000));
  }, [timerEnd, total]);

  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerEnd]);

  return { secs, total: totalRef.current };
}

/**
 * Color por urgencia restante — mismo umbral (rojo bajo 15s, ámbar bajo 30s,
 * verde el resto) que cada timer circular/anillo del juego terminaba
 * reimplementando por su cuenta. Un único lugar en vez de 3+ copias del
 * mismo ternario anidado.
 */
export function timerUrgencyColor(secondsLeft: number): string {
  return secondsLeft < 15 ? "#E24B4A" : secondsLeft < 30 ? "#EF9F27" : "#5DCAA5";
}
