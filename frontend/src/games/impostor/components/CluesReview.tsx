import { S } from "../../../theme/styles";

interface CluesReviewProps {
  clues: Record<string, string> | undefined;
  players: { id: string | number; name: string }[];
  // LocalGame's players give their word out loud by default (clues are only
  // ever written when "Pistas escritas" is on, so the label there is "Pistas"
  // to match that framing) — online always writes them, so it reads as
  // "Palabras" instead. Defaults to the online wording.
  label?: string;
}

// Shared between LocalGame and RoundView — same list of "who wrote what"
// once at least one clue's been submitted, just with a different label and
// player id type (local's are numeric, online's are string room-player ids).
export function CluesReview({ clues, players, label = "Palabras" }: CluesReviewProps) {
  const entries = Object.entries(clues || {}).filter(([, clue]) => clue);
  if (entries.length === 0) return null;
  return (
    <div style={S.card}>
      <span style={S.label}>{label}</span>
      {entries.map(([playerId, clue]) => {
        const p = players.find(x => String(x.id) === playerId);
        if (!p) return null;
        return (
          <p key={playerId} style={{ fontSize: 14, margin: "4px 0", color: "var(--jt-muted-text)" }}>
            <strong style={{ color: "#FF8A8A" }}>{p.name}:</strong> {clue}
          </p>
        );
      })}
    </div>
  );
}
