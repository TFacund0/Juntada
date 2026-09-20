import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Avatar } from "../../../components/ui/Avatar";

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
        <div className={clsx(T.cardHighlight, "text-center")}>
          <span className={T.label}>{"Ganador" + (isTie ? "es" : "")}</span>
          <p className="text-xl font-extrabold text-[#AFA9EC] my-1">🏆 {isTie ? winners.map(w => w.name).join(" y ") : winners[0].name}</p>
          <p className={T.muted}>{topScore.toFixed(2)} puntos</p>
        </div>
      )}

      <div className={T.card}>
        <span className={T.label}>Tabla de puntuación</span>
        {standings.map((entry, i) => (
          <div
            key={entry.id}
            className={clsx("flex items-center gap-2.5 py-1.5", i < standings.length - 1 ? "border-b border-[rgba(127,119,221,0.08)]" : "")}
          >
            <span className="w-5 text-xs font-extrabold text-[#6b6490]">{i + 1}</span>
            <Avatar name={entry.name} size={28} />
            <span className="flex-1 text-sm font-bold">
              {entry.name}
              {entry.online === false ? " (desconectado)" : ""}
            </span>
            <span className="font-extrabold text-[#AFA9EC] min-w-[44px] text-right">{entry.score.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
