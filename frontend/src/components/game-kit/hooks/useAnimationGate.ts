import { useCallback, useEffect, useRef } from "react";

// How long after the page comes back into view state changes still count as
// "catching up" rather than news: a phone that froze the tab reconnects and
// receives the current state a moment after it's visible again.
export const RESUME_GRACE_MS = 1000;

/**
 * Pure rule behind {@link useAnimationGate}: an event animation (a jump, a
 * reveal, a sound) only plays when the page is visible and wasn't just
 * resumed — otherwise it's stale news and the screen should simply show the
 * current state.
 */
export function canAnimateAt(now: number, hidden: boolean, visibleSince: number): boolean {
  return !hidden && now - visibleSince >= RESUME_GRACE_MS;
}

/**
 * Returns a function telling whether an event animation should play right
 * now. Coming back from another tab/app must not replay animations for
 * whatever happened in the meantime — state that changed while hidden (or
 * that arrives right after coming back) is shown as-is instead.
 */
export function useAnimationGate(): () => boolean {
  // -Infinity: at mount the page has been "visible" for as long as we care.
  const visibleSince = useRef(Number.NEGATIVE_INFINITY);

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "visible") visibleSince.current = Date.now();
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return useCallback(() => canAnimateAt(Date.now(), document.visibilityState === "hidden", visibleSince.current), []);
}
