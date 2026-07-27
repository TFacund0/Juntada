// Beat 1 of "reveal" — the plain "Ronda N" announcement, no items or gun
// yet, shown identically by both LocalGame and RoundView before it moves on
// by itself (each owns its own timer, this is just the screen).
export function RoundAnnounce({ roundNumber }: { roundNumber: number }) {
  return (
    <div className="recamara">
      <div className="table round-intro">
        <p className="round-intro-eyebrow mono">Ronda</p>
        <p className="round-intro-number display">{roundNumber}</p>
      </div>
    </div>
  );
}
