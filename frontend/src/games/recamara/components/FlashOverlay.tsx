// A brief full-screen text flash — used for the "Turno de X" handoff
// between chests and the "A disparar" duel-transition, same markup either
// way (see LocalGame's handoffName/duelTransition and RoundView's chamber
// beat). Purely presentational; the caller owns the timing.
export function FlashOverlay({ text }: { text: string }) {
  return (
    <div className="rec-overlay">
      <div className="rec-flash-card">
        <span className="display">{text}</span>
      </div>
    </div>
  );
}
