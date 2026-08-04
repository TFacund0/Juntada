import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/ui/Avatar";
// Misma forma que ya necesitaba PodiumBoard (el podio de fin de partida,
// ahora compartido en components/game-kit) — una sola definición del tipo
// en vez de que cada juego declare la suya. Reexportado para que nada que
// ya importe ScoreboardEntry desde acá (ej. RoundScoreboard.tsx) se rompa.
import type { ScoreboardEntry } from "../../../components/game-kit/PodiumBoard";
export type { ScoreboardEntry } from "../../../components/game-kit/PodiumBoard";

// Shared by both LocalGame and RoundView (they used to each carry their own
// near-identical copy) — takes a plain list of entries instead of a Room or
// LocalPlayer[] shape, so it doesn't need to know which mode is rendering it.
export function Scoreboard({ entries, title = "Tabla de puntos" }: { entries: ScoreboardEntry[]; title?: string }) {
  const ranked = [...entries].sort((a, b) => b.score - a.score);
  return (
    <div style={S.card}>
      <span style={S.label}>{title}</span>
      {ranked.map((e, i) => (
        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
          <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: i === 0 ? "#E2C44A" : "#6b6490" }}>{i + 1}</span>
          <Avatar name={e.name} size={22} />
          <span style={{ flex: 1, fontWeight: 700, fontSize: 12 }}>
            {e.name}
            {e.isMe && " (vos)"}
          </span>
          {!!e.roundPoints && <span style={{ fontSize: 11, fontWeight: 700, color: "#5DCAA5" }}>+{e.roundPoints}</span>}
          <span style={{ fontSize: 12, fontWeight: 800, color: "#5DCAA5" }}>{e.score} pts</span>
        </div>
      ))}
    </div>
  );
}
