import { S } from "../../theme/styles";
import { Avatar } from "../../components/Avatar";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  online?: boolean;
}

// One shared "who's winning" block for both modes: a highlighted callout for
// the winner(s) — tie-aware, since two players landing on the exact same
// score is common with this scoring formula — on top of the full ranked
// list underneath. Used by LocalGame's final standings and RoundView's
// online scoreboard so both read the same way.
export function Leaderboard({ standings, finished = false }: { standings: LeaderboardEntry[]; finished?: boolean }) {
  if (standings.length === 0) return null;
  const topScore = standings[0].score;
  const winners = standings.filter(s => s.score === topScore);
  const isTie = winners.length > 1;

  return (
    <div>
      {finished && (
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <span style={S.label}>{"Ganador" + (isTie ? "es" : "")}</span>
          <p style={{ fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>
            🏆 {isTie ? winners.map(w => w.name).join(" y ") : winners[0].name}
          </p>
          <p style={S.muted}>{topScore.toFixed(2)} puntos</p>
        </div>
      )}

      <div style={S.card}>
        <span style={S.label}>Tabla de puntuación</span>
        {standings.map((entry, i) => (
          <div
            key={entry.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              borderBottom: i < standings.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none",
            }}
          >
            <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
            <Avatar name={entry.name} size={28} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
              {entry.name}
              {entry.online === false ? " (desconectado)" : ""}
            </span>
            <span style={{ fontWeight: 800, color: "#AFA9EC", minWidth: 44, textAlign: "right" }}>{entry.score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
