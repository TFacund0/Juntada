import { useEffect, useRef } from "react";
import { BANNER_TAP_GUARD_MS } from "../utils/timing";

// How every result card moves on (ResultBanner, EliminationBanner): a tap
// anywhere or Enter/Space/Escape after a short guard — so the tap that fired
// the shot doesn't also skip its own result — or by itself after `autoMs`.
// Every path goes through the same once-only finish: a tap on the card's own
// button would otherwise count twice (pointerdown, then click) and skip the
// next queued event. Returns that finish, for the card's button.
export function useBannerDismiss(onContinue: () => void, autoMs: number): () => void {
  const latest = useRef(onContinue);
  useEffect(() => {
    latest.current = onContinue;
  });
  const done = useRef(false);
  const finish = useRef(() => {
    if (done.current) return;
    done.current = true;
    latest.current();
  }).current;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") finish();
    };
    const guard = setTimeout(() => {
      window.addEventListener("pointerdown", finish);
      window.addEventListener("keydown", onKey);
    }, BANNER_TAP_GUARD_MS);
    const auto = setTimeout(finish, autoMs);
    return () => {
      clearTimeout(guard);
      clearTimeout(auto);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", onKey);
    };
  }, [finish, autoMs]);

  return finish;
}
