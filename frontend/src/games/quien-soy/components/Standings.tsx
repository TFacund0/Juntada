import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/Avatar";
import { computeMatchRanks, type QuienSoyResult } from "@juntada/quien-soy-data";

export interface StandingEntry {
  id: string;
  name: string;
  outcome: "solved" | "eliminated" | "conceded" | "playing";
  rank: number | null; // null when still playing or didn't solve
  word: string | null; // revealed word, once known
  points: number;
  // Cumulative score across matches (room.config.score online, or the
  // equivalent local running total) — undefined hides the total entirely,
  // so a lone match with nothing to accumulate yet doesn't show a stray 0.
  totalScore?: number;
}

const OUTCOME_LABEL: Record<StandingEntry["outcome"], string> = {
  solved: "Acertó",
  eliminated: "Eliminado",
  conceded: "Se rindió",
  playing: "Jugando…",
};

// Turns the round's raw results + revealed words into the sorted entries
// Standings renders — same shape-building logic local pass-and-play's
// "final" screen and the online RoundView's "result" phase both need,
// differing only in where `results`/`words` come from.
export function buildStandingEntries(
  players: { id: string; name: string }[],
  results: QuienSoyResult[],
  words: Record<string, string | null | undefined>,
  totalScores?: Record<string, number>,
): StandingEntry[] {
  const ranks = computeMatchRanks(results, players.length);
  return players
    .map(p => {
      const result = results.find(r => r.playerId === p.id);
      const rankInfo = ranks[p.id];
      return {
        id: p.id,
        name: p.name,
        outcome: (result?.outcome ?? "playing") as StandingEntry["outcome"],
        rank: rankInfo?.rank ?? null,
        word: words[p.id] ?? null,
        points: rankInfo?.points ?? 0,
        totalScore: totalScores ? (totalScores[p.id] ?? 0) : undefined,
      };
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
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
          <div style={{ textAlign: "right" }}>
            {entry.points > 0 && <span style={{ fontWeight: 800, color: "#AFA9EC" }}>+{entry.points}</span>}
            {entry.totalScore != null && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b6490" }}>Total: {entry.totalScore}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
