import { useEffect, useState, type CSSProperties } from "react";
import type { ShellKind } from "@juntada/recamara-engine";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { usePrefersReducedMotion } from "../hooks/reducedMotion";
import { RELOAD_FLIP_MS, RELOAD_HOLD_MS, RELOAD_SHELL_IN_MS, RELOAD_SHELL_LOAD_MS, RELOAD_SHUFFLE_MS } from "../utils/timing";
import { ShellIcon } from "./ShellIcon";

// The chamber being loaded, on the chamber card (ported from the reference's
// reload()): the round's real and blank shells pop in face-up, hold so the
// table can memorize the split, flip face-down, shuffle, and slide into the
// gun one by one. Only the *count* is public — the order the shells end up
// in is never shown, since they're face-down before they shuffle. With
// reduced motion it just shows them face-up, no flip or shuffle.
export type ReloadPhase = "in" | "hold" | "flip" | "shuffle" | "load" | "done";

interface ReloadSequenceProps {
  liveCount: number;
  blankCount: number;
  sfx?: RecamaraSfx;
}

export function ReloadSequence({ liveCount, blankCount, sfx }: ReloadSequenceProps) {
  const total = liveCount + blankCount;
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<ReloadPhase>(reduced ? "hold" : "in");
  const [popped, setPopped] = useState(reduced ? total : 0);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let t = 0;
    for (let i = 0; i < total; i++) {
      at(t, () => {
        setPopped(i + 1);
        sfx?.play("pop");
      });
      t += RELOAD_SHELL_IN_MS;
    }
    at(t, () => setPhase("hold"));
    t += RELOAD_HOLD_MS;
    at(t, () => setPhase("flip"));
    t += RELOAD_FLIP_MS;
    at(t, () => {
      setPhase("shuffle");
      sfx?.play("load");
    });
    t += RELOAD_SHUFFLE_MS;
    at(t, () => setPhase("load"));
    for (let i = 0; i < total; i++) {
      at(t, () => {
        setLoaded(i + 1);
        sfx?.play("load");
      });
      t += RELOAD_SHELL_LOAD_MS;
    }
    at(t, () => {
      setPhase("done");
      sfx?.play("rack");
    });
    return () => timers.forEach(clearTimeout);
    // Plays once per mount (one chamber card per reload); sfx is stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, reduced]);

  const faceUp = phase === "in" || phase === "hold";
  const kinds: ShellKind[] = [...Array<ShellKind>(liveCount).fill("live"), ...Array<ShellKind>(blankCount).fill("blank")];

  return (
    <div className={`bullet-row reload-row phase-${phase}`}>
      {kinds.map((kind, i) => (
        <span
          key={i}
          className={`reload-shell${i < popped ? " in" : ""}${i < loaded ? " loaded" : ""}`}
          style={{ "--i": i } as CSSProperties}
          aria-hidden="true"
        >
          <ShellIcon kind={faceUp ? kind : null} />
        </span>
      ))}
    </div>
  );
}
