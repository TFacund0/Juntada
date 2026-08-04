import type { TutifrutiRoundState } from "../types";

// Ronda X/Y indicator, shown at the top of every phase — texto grande con
// el degradé del tema en vez de una card/pill (a propósito no lleva fondo
// ni borde, es un título de sección, no un badge encerrado).
export function RoundBadge({ round }: { round: TutifrutiRoundState }) {
  if (!round.totalRounds) return null;
  return (
    <p className="tf-round-badge">
      Ronda {round.roundNumber} <span className="tf-round-badge__sep">/</span> {round.totalRounds}
    </p>
  );
}
