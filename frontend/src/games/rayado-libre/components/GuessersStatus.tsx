import { S } from "../../../theme/styles";
import type { RoundViewProps } from "../../gameTypes";

/**
 * Panel en vivo de "quién ya adivinó" durante "drawing": una fila por cada
 * jugador que no dibuja, para ver de un vistazo quién sigue pensando versus
 * quién ya sumó puntos (y cuántos), sin tener que revisar el chat.
 */
export function GuessersStatus({
  players,
  drawerId,
  correctGuessers,
  roundPoints,
}: {
  players: RoundViewProps["room"]["players"];
  drawerId: string;
  correctGuessers: string[];
  roundPoints: Record<string, number>;
}) {
  const guessers = players.filter(p => p.id !== drawerId);
  if (guessers.length === 0) return null;
  return (
    <div style={{ ...S.card, marginBottom: 12 }}>
      <span style={S.label}>Quién ya adivinó</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {guessers.map(p => {
          const solved = correctGuessers.includes(p.id);
          return (
            <div
              key={p.id}
              style={{
                ...S.pill(solved),
                opacity: p.online ? 1 : 0.55,
              }}
            >
              {solved ? "✓ " : ""}
              {p.name}
              {solved ? ` · +${roundPoints[p.id] ?? 0}` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
