// A brief full-screen text flash — used for the "Turno de X" handoff
// between chests and the "A disparar" duel-transition, same markup either
// way (see LocalGame's handoffName/duelTransition and RoundView's
// duelTransition). Purely presentational; the caller owns the timing.
//
// Solid background (not the translucent ".rec-overlay" sheets/modals use)
// on purpose — this is meant to read as a clean beat between two screens,
// not a dimmed modal over whatever's still showing behind it. RoundView in
// particular overlays this on top of the "esperando a los demás" list,
// which looked bad bleeding through a half-transparent backdrop.
export function FlashOverlay({ text }: { text: string }) {
  return (
    <div className="rec-overlay rec-overlay-solid">
      <div className="rec-flash-card">
        <span className="display">{text}</span>
      </div>
    </div>
  );
}
