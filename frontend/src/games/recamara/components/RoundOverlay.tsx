import { useEffect, useRef } from "react";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { ROUND_OUTRO_MS, ROUND_TITLE_MS } from "../utils/timing";
import { ReloadSequence } from "./ReloadSequence";

interface RoundOverlayProps {
  roundNumber: number;
  liveCount: number;
  blankCount: number;
  sfx?: RecamaraSfx;
  // Called once the chamber is loaded and the overlay is done — the caller
  // then lifts it off the table (and, online, tells the server it's ready).
  onDone: () => void;
}

// The start of every round, over the table (the reference's #reload
// overlay): "RONDA N" settles in, the chamber's shells are shown, memorized,
// flipped, shuffled and loaded, then the overlay lifts and the duel goes on
// right underneath — no separate screens in between.
export function RoundOverlay({ roundNumber, liveCount, blankCount, sfx, onDone }: RoundOverlayProps) {
  const outro = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });
  useEffect(() => () => clearTimeout(outro.current), []);

  return (
    <div className="round-overlay" role="status" aria-label={`Ronda ${roundNumber}`}>
      <h2 className="round-overlay-title display">Ronda {roundNumber}</h2>
      <ReloadSequence
        liveCount={liveCount}
        blankCount={blankCount}
        sfx={sfx}
        delayMs={ROUND_TITLE_MS}
        onDone={() => {
          outro.current = setTimeout(() => latest.current(), ROUND_OUTRO_MS);
        }}
      />
    </div>
  );
}
