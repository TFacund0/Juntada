import { useState, useEffect } from "react";
import { S } from "../theme/styles";

// Builds a beat of suspense before a round's result is shown, instead of
// dumping the outcome the instant the phase flips. `resetKey` should be
// something that changes once per new result (e.g. room.roundHistory.length)
// so the countdown restarts for each round but doesn't restart on every
// unrelated re-render while phase stays "result".
export function useRevealCountdown(resetKey: unknown, seconds = 3): number {
  const [count, setCount] = useState(seconds);
  // Tracks the resetKey seen on the last render so a change can be caught
  // synchronously during render (see below) rather than only in an effect,
  // which runs *after* the browser has already painted this render's
  // (stale) count — that gap is what let the previous round's finished
  // countdown (0) flash the real result for a frame before resetting to 3.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  // "Adjusting state during rendering" (see React docs): updating state
  // here, mid-render, immediately triggers a re-render before paint, so the
  // very first render for a new round already shows the reset count instead
  // of leaking last round's finished value.
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setCount(seconds);
  }

  useEffect(() => {
    if (seconds <= 0) return;
    const interval = setInterval(() => {
      setCount(c => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [resetKey, seconds]);

  return count; // 0 once the countdown finished — safe to reveal
}

interface RevealCountdownProps {
  count: number;
  label?: string;
}

export function RevealCountdown({ count, label = "Revelando resultado..." }: RevealCountdownProps) {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center", padding: "48px 20px" }}>
      <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 10 }}>{label}</p>
      <p style={{ fontSize: 56, fontWeight: 800, color: "#AFA9EC", margin: 0, lineHeight: 1 }}>{count}</p>
    </div>
  );
}
