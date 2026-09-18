import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Avatar } from "../../../components/ui/Avatar";
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
    <div className={T.card}>
      <span className={T.label}>Resultados</span>
      {entries.map(entry => (
        <div key={entry.id} className="flex items-center gap-2.5 py-2 border-b border-[rgba(127,119,221,0.08)]">
          <span className={clsx("w-6 text-center text-[13px] font-extrabold", entry.rank === 1 ? "text-[#E2C44A]" : "text-[#6b6490]")}>
            {entry.rank ? (entry.rank === 1 ? "🏆" : `#${entry.rank}`) : "—"}
          </span>
          <Avatar name={entry.name} size={28} />
          <div className="flex-1">
            <p className="font-bold text-sm">{entry.name}</p>
            <p
              className={clsx(
                "text-xs",
                entry.outcome === "solved" ? "text-[#5DCAA5]" : entry.outcome === "playing" ? "text-[#9089c0]" : "text-[#F09595]",
              )}
            >
              {OUTCOME_LABEL[entry.outcome]}
              {entry.word ? ` — era "${entry.word}"` : ""}
            </p>
          </div>
          <div className="text-right">
            {entry.points > 0 && <span className="font-extrabold text-[#AFA9EC]">+{entry.points}</span>}
            {entry.totalScore != null && <p className="mt-0.5 text-[11px] text-[#6b6490]">Total: {entry.totalScore}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
