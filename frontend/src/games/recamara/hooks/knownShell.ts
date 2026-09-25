import { useEffect, useState } from "react";
import type { ShellKind } from "@juntada/recamara-engine";
import type { PlayingFx } from "../utils/playingFx";

// What this device learned with the 🔍 — shown as the "La próxima es REAL"
// pill in the chamber strip (like the reference's setKnown) until the next
// shot is fired, or the chamber reloads. Only a 🔍 whose result this device
// actually saw sets it (revealedShellKind is null for everyone else, see
// playingFx.ts).
export function useKnownShell(playing: PlayingFx | null, roundNumber: number): ShellKind | null {
  const [known, setKnown] = useState<ShellKind | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (playing.kind === "shot") setKnown(null);
    else if (playing.item === "🔍" && playing.revealedShellKind) setKnown(playing.revealedShellKind);
  }, [playing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setKnown(null);
  }, [roundNumber]);

  return known;
}
