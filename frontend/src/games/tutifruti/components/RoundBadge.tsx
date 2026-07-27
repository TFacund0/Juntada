import { S } from "../../../theme/styles";
import type { TutifrutiRoundState } from "../types";

// Ronda X/Y indicator, shown at the top of every phase.
export function RoundBadge({ round }: { round: TutifrutiRoundState }) {
  if (!round.totalRounds) return null;
  return (
    <p style={{ ...S.muted, textAlign: "center", marginBottom: 10 }}>
      Ronda {round.roundNumber}/{round.totalRounds}
    </p>
  );
}
