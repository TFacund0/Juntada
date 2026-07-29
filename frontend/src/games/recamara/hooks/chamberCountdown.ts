import { useEffect, useRef, useState } from "react";

// The chamber card (gun + real/falso shell count) holds itself up for `ms`
// with a visible countdown, then moves on by itself — LocalGame calls
// enterDuel(), RoundView sends ready_for_duel — same timer either way, just
// a different action once it runs out. `onDone` is read through a ref so
// callers can pass a fresh inline closure every render without retriggering
// the timer (only `active`/`ms` do).
export function useChamberCountdown(active: boolean, ms: number, onDone: () => void): number {
  const [introEndsAt, setIntroEndsAt] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!active) return;
    setIntroEndsAt(Date.now() + ms);
    const t = setTimeout(() => onDoneRef.current(), ms);
    return () => clearTimeout(t);
  }, [active, ms]);

  return introEndsAt;
}
