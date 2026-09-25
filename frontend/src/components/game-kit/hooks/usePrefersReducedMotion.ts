import { useEffect, useState } from "react";

// The JS side of prefers-reduced-motion, for sequences driven by timers or
// the Web Animations API rather than CSS (the CSS side is each game's own
// `motion-reduce:` classes or media query). Tracks changes live. Moved here
// from recamara once rayado-libre needed the same thing.
const QUERY = "(prefers-reduced-motion: reduce)";

function matches(): boolean {
  try {
    return typeof window !== "undefined" && !!window.matchMedia?.(QUERY).matches;
  } catch {
    return false;
  }
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(matches);
  useEffect(() => {
    const mql = window.matchMedia?.(QUERY);
    if (!mql) return;
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}
