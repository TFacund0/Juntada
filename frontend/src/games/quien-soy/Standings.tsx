import { S } from "../../theme/styles";
import { Avatar } from "../../components/Avatar";

export interface StandingEntry {
  id: string;
  name: string;
  outcome: "solved" | "eliminated" | "conceded" | "playing";
  rank: number | null; // null when still playing or didn't solve
  word: string | null; // revealed word, once known
  points: number;
}

const OUTCOME_LABEL: Record<StandingEntry["outcome"], string> = {
  solved: "Acertó",
  eliminated: "Eliminado",
  conceded: "Se rindió",
  playing: "Jugando…",
};

// Mirrors engine.ts's finalizeResults — same lap-tie logic, just computed
// client-side purely for display (the authoritative cumulative score still
// only ever gets written server-side, into room.config.score).
export function computeMatchRanks(
  results: { playerId: string; outcome: "solved" | "eliminated" | "conceded"; lap: number }[],
  playerCount: number,
): Record<string, { rank: number; points: number }> {
  const solved = results.filter(r => r.outcome === "solved").sort((a, b) => a.lap - b.lap);
  const out: Record<string, { rank: number; points: number }> = {};
  let rank = 0;
  let lastLap: number | null = null;
  solved.forEach((res, i) => {
    if (res.lap !== lastLap) {
      rank = i + 1;
      lastLap = res.lap;
    }
    out[res.playerId] = { rank, points: Math.max(0, playerCount - rank + 1) };
  });
  return out;
}

// Final (or live, while still playing) ranking: who solved their word first
// — tied ranks share the same number, per the "same lap = both win" scoring
// — who got eliminated, and who conceded. Shared by local pass-and-play's
// results screen and the online RoundView's "result" phase.
export function Standings({ entries }: { entries: StandingEntry[] }) {
  return (
    <div style={S.card}>
      <span style={S.label}>Resultados</span>
      {entries.map(entry => (
        <div
          key={entry.id}
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)" }}
        >
          <span style={{ width: 24, textAlign: "center", fontSize: 13, fontWeight: 800, color: entry.rank === 1 ? "#E2C44A" : "#6b6490" }}>
            {entry.rank ? (entry.rank === 1 ? "🏆" : `#${entry.rank}`) : "—"}
          </span>
          <Avatar name={entry.name} size={28} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{entry.name}</p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: entry.outcome === "solved" ? "#5DCAA5" : entry.outcome === "playing" ? "#9089c0" : "#F09595",
              }}
            >
              {OUTCOME_LABEL[entry.outcome]}
              {entry.word ? ` — era "${entry.word}"` : ""}
            </p>
          </div>
          {entry.points > 0 && <span style={{ fontWeight: 800, color: "#AFA9EC" }}>+{entry.points}</span>}
        </div>
      ))}
    </div>
  );
}
