import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
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
    <div className={T.card}>
      <span className={T.label}>{title}</span>
      {ranked.map((e, i) => (
        <div key={e.id} className="flex items-center gap-2 py-[5px]">
          <span className={clsx("w-4 text-xs font-extrabold", i === 0 ? "text-[#E2C44A]" : "text-[#6b6490]")}>{i + 1}</span>
          <Avatar name={e.name} size={22} />
          <span className="flex-1 font-bold text-xs">
            {e.name}
            {e.isMe && " (vos)"}
          </span>
          {!!e.roundPoints && <span className="text-[11px] font-bold text-[#5DCAA5]">+{e.roundPoints}</span>}
          <span className="text-xs font-extrabold text-[#5DCAA5]">{e.score} pts</span>
        </div>
      ))}
    </div>
  );
}
