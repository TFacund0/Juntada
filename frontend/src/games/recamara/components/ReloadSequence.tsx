import { useEffect, useState, type CSSProperties } from "react";
import type { ShellKind } from "@juntada/recamara-engine";
import type { RecamaraSfx } from "../hooks/recamaraSfx";
import { usePrefersReducedMotion } from "../hooks/reducedMotion";
import { RELOAD_FLIP_MS, RELOAD_HOLD_MS, RELOAD_SHELL_IN_MS, RELOAD_SHELL_LOAD_MS, RELOAD_SHUFFLE_MS } from "../utils/timing";
import { ShellIcon } from "./ShellIcon";

// The chamber being loaded (ported from the reference's reload()): the
// round's real and blank shells pop in face-up with their count spelled
// out, hold so the table can memorize the split, flip face-down, shuffle,
// and slide into the gun one by one. Only the *count* is public — the order
// the shells end up in is never shown, since they're face-down before they
// shuffle. With reduced motion it just shows them face-up for the hold.
export type ReloadPhase = "in" | "hold" | "flip" | "shuffle" | "load" | "done";

interface ReloadSequenceProps {
  liveCount: number;
  blankCount: number;
  sfx?: RecamaraSfx;
  // Wait this long before the first shell (e.g. for a title to settle in).
  delayMs?: number;
  // Called once the last shell is in the gun.
  onDone?: () => void;
}

export function ReloadSequence({ liveCount, blankCount, sfx, delayMs = 0, onDone }: ReloadSequenceProps) {
  const total = liveCount + blankCount;
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<ReloadPhase>(reduced ? "hold" : "in");
  const [popped, setPopped] = useState(reduced ? total : 0);
  const [loaded, setLoaded] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    let t = delayMs;
    if (reduced) {
      at(t + RELOAD_HOLD_MS, () => {
        setPhase("done");
        onDone?.();
      });
      return () => timers.forEach(clearTimeout);
    }
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
        sfx?.play("load", 0.36);
      });
      t += RELOAD_SHELL_LOAD_MS;
    }
    at(t, () => {
      setPhase("done");
      sfx?.play("rack");
      onDone?.();
    });
    return () => timers.forEach(clearTimeout);
    // Plays once per mount (one overlay per reload); sfx/onDone are read at fire time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, reduced]);

  const faceUp = phase === "in" || phase === "hold";
  const kinds: ShellKind[] = [...Array<ShellKind>(liveCount).fill("live"), ...Array<ShellKind>(blankCount).fill("blank")];

  return (
    <>
      <p className="reload-legend" aria-live="polite">
        {phase !== "in" && (
          <>
            <b className="live">
              {liveCount} real{liveCount === 1 ? "" : "es"}
            </b>
            {" · "}
            <b className="blank">
              {blankCount} falsa{blankCount === 1 ? "" : "s"}
            </b>
          </>
        )}
      </p>
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
      <p className="reload-hint">{phase === "hold" ? "Memorizá. El orden va a ser secreto." : ""}</p>
    </>
  );
}
