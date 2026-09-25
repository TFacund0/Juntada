import { useEffect, useState } from "react";

// The JS side of prefers-reduced-motion, for sequences driven by timers
// rather than CSS (the CSS side lives in motion.css). Tracks changes live.
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
