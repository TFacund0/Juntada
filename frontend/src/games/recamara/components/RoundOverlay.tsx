import { useEffect, useRef, useState } from "react";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { ROUND_OUTRO_MS, ROUND_TITLE_MS } from "../utils/timing";
import { ItemChest, type ChestTurn } from "./ItemChest";
import { ReloadSequence } from "./ReloadSequence";

interface RoundOverlayProps {
  roundNumber: number;
  liveCount: number;
  blankCount: number;
  // The chests to open once the chamber is loaded, in order (local: every
  // player who got something; online: only this device's own). Empty on
  // round 1, which deals no items.
  chests?: ChestTurn[];
  sfx?: RecamaraSfx;
  // Called once the chamber is loaded, every chest is open and the overlay
  // is done — the caller then lifts it off the table (and, online, tells the
  // server it's ready).
  onDone: () => void;
}

// The start of every round, over the table (the reference's #reload
// overlay): "RONDA N" settles in, the chamber's shells are shown, memorized,
// flipped, shuffled and loaded, then — after a reload — the new items come
// out of their chest one tap at a time, and the overlay lifts with the duel
// going on right underneath — no separate screens in between.
export function RoundOverlay({ roundNumber, liveCount, blankCount, chests = [], sfx, onDone }: RoundOverlayProps) {
  // null while the chamber is still loading, then the index of the chest
  // being opened.
  const [chestIdx, setChestIdx] = useState<number | null>(null);
  const outro = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });
  useEffect(() => () => clearTimeout(outro.current), []);

  const lift = () => {
    outro.current = setTimeout(() => latest.current(), ROUND_OUTRO_MS);
  };
  const next = (from: number) => {
    if (from < chests.length) setChestIdx(from);
    else lift();
  };
  const chest = chestIdx != null ? chests[chestIdx] : null;

  return (
    <div className="round-overlay" role="status" aria-label={`Ronda ${roundNumber}`}>
      <h2 className={`round-overlay-title display${chest ? " small" : ""}`}>Ronda {roundNumber}</h2>
      {chest ? (
        <ItemChest key={chestIdx} {...chest} sfx={sfx} onDone={() => next(chestIdx! + 1)} />
      ) : (
        <ReloadSequence liveCount={liveCount} blankCount={blankCount} sfx={sfx} delayMs={ROUND_TITLE_MS} onDone={() => next(0)} />
      )}
    </div>
  );
}
