import { S } from "../../../theme/styles";

// One player's result row for a round: name + score, target color vs. their
// guess side by side so the gap between them is visible at a glance. Shared
// by local pass-and-play (LocalGame's roundResult) and the online RoundView
// result phase — same round data, same comparison, so it only needs to be
// laid out once.
export function ColorCompareRow({
  name,
  target,
  guess,
  score,
  highlight,
  isRoundWinner,
}: {
  name: string;
  target: string;
  guess: string | undefined;
  score: number | undefined;
  highlight?: boolean;
  isRoundWinner?: boolean;
}) {
  return (
    <div style={isRoundWinner ? S.cardHighlight : S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 700 }}>
          {isRoundWinner ? "🏆 " : ""}
          {name}
          {highlight ? " (vos)" : ""}
        </span>
        <span style={{ fontWeight: 800, fontSize: 16, color: "#5DCAA5" }}>{score != null ? score.toFixed(2) : "—"}</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ width: "100%", aspectRatio: "2 / 1", borderRadius: 10, background: target }} />
          <span style={{ ...S.muted, fontSize: 11 }}>Real</span>
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ width: "100%", aspectRatio: "2 / 1", borderRadius: 10, background: guess ?? "#333" }} />
          <span style={{ ...S.muted, fontSize: 11 }}>{name}</span>
        </div>
      </div>
    </div>
  );
}
