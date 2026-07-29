import { useEffect, useRef, useState } from "react";

// The "A disparar" themed flash (see FlashOverlay) that bridges the reveal's
// last beat into the actual duel — LocalGame already had this for its own
// (locally-timed) subPhase switch; this hook brings the same beat to
// RoundView, where subPhase instead flips to "duel" the instant the server
// sees everyone ready, with no transition of its own. Detects that false ->
// true edge and holds `showDuel` back for `ms` while `flashing` is true, so
// the caller can keep rendering its last reveal screen with the flash
// overlaid on top before actually switching to the duel view — instead of a
// hard cut the moment the server update lands.
export function useDuelEntryFlash(isDuel: boolean, ms: number): { flashing: boolean; showDuel: boolean } {
  const [flashing, setFlashing] = useState(false);
  const [showDuel, setShowDuel] = useState(isDuel);
  const wasDuelRef = useRef(isDuel);

  useEffect(() => {
    if (isDuel && !wasDuelRef.current) {
      wasDuelRef.current = true;
      setFlashing(true);
      const t = setTimeout(() => {
        setFlashing(false);
        setShowDuel(true);
      }, ms);
      return () => clearTimeout(t);
    }
    if (!isDuel) {
      wasDuelRef.current = false;
      setFlashing(false);
      setShowDuel(false);
    }
  }, [isDuel, ms]);

  return { flashing, showDuel };
}
