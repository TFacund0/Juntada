import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

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
    <div className={isRoundWinner ? T.cardHighlight : T.card}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold">
          {isRoundWinner ? "🏆 " : ""}
          {name}
          {highlight ? " (vos)" : ""}
        </span>
        <span className="font-extrabold text-base text-[#5DCAA5]">{score != null ? score.toFixed(2) : "—"}</span>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 text-center">
          <div className="w-full aspect-[2/1] rounded-[10px]" style={{ background: target }} />
          <span className={clsx(T.muted, "text-[11px]")}>Real</span>
        </div>
        <div className="flex-1 text-center">
          <div className="w-full aspect-[2/1] rounded-[10px]" style={{ background: guess ?? "#333" }} />
          <span className={clsx(T.muted, "text-[11px]")}>{name}</span>
        </div>
      </div>
    </div>
  );
}
