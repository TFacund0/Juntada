import { forwardRef } from "react";
import clsx from "clsx";
import { Avatar } from "../../../../components/ui/Avatar";
import type { TurnScoreRow } from "../../utils/turnScores";

interface ScoreRowProps {
  row: TurnScoreRow;
  /** Lo que muestra ahora el "+N" y el total (cambian mientras cuentan). */
  plus: number;
  total: number;
}

/** Una fila de la tabla del turno (`.srow` de la referencia): avatar, nombre y motivo, "+N" y total. */
export const ScoreRow = forwardRef<HTMLDivElement, ScoreRowProps>(function ScoreRow({ row, plus, total }, ref) {
  return (
    <div
      ref={ref}
      className={clsx(
        "flex items-center gap-2.5 rounded-[14px] border bg-rl-card px-3 py-[9px] text-left",
        row.isMe ? "border-rl-ok/50" : "border-rl-card-border",
      )}
    >
      <Avatar name={row.name} size={34} />
      <span className="min-w-0 flex-1 font-bold">
        <span className="block truncate">
          {row.name}
          {row.isDrawer && " ✏️"}
          {row.isMe && <span className="sr-only"> (vos)</span>}
        </span>
        <span className="block text-xs font-semibold text-rl-muted">{row.why}</span>
      </span>
      <span className={clsx("min-w-[44px] text-right text-sm font-extrabold tabular-nums", row.plus ? "text-rl-ok" : "text-rl-muted")}>
        +{plus}
      </span>
      <span className="min-w-[48px] text-right text-xl font-extrabold tabular-nums">{total}</span>
    </div>
  );
});
