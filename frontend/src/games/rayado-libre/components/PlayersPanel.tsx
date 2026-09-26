import { memo } from "react";
import clsx from "clsx";
import { Avatar } from "../../../components/ui/Avatar";
import type { PlayerRow } from "../utils/playerRows";
import { TypingDots } from "./TypingDots";

function StatusLine({ row }: { row: PlayerRow }) {
  if (row.status === "drawing") return <>✏️ dibujando</>;
  if (row.status === "guessed") return <>✓ adivinó · +{row.gained}</>;
  if (row.status === "typing")
    return (
      <>
        <TypingDots /> escribiendo
      </>
    );
  return null;
}

/**
 * Panel "Jugadores" de la columna izquierda en compu (contenedor ≥1000px;
 * oculto por debajo): ordenado por puntaje, con avatar, nombre, puntos y el
 * estado de cada uno en el turno — dibujando, adivinó (+N) o escribiendo.
 */
export const PlayersPanel = memo(function PlayersPanel({ rows }: { rows: PlayerRow[] }) {
  return (
    <aside
      aria-label="Jugadores"
      className="hidden self-start rounded-[18px] border border-rl-card-border bg-rl-surface px-[10px] py-[14px] @min-[1000px]:flex @min-[1000px]:flex-col @min-[1000px]:gap-1"
    >
      <h3 className="m-0 mb-[10px] text-xs font-extrabold uppercase tracking-[.06em] text-rl-muted">Jugadores</h3>
      {rows.map(row => (
        <div
          key={row.id}
          className={clsx(
            "flex items-center gap-[10px] rounded-xl border px-[10px] py-2",
            row.status === "drawing"
              ? "border-rl-card-border bg-[rgba(127,119,221,.12)]"
              : row.status === "guessed"
                ? "border-[rgba(51,192,122,.35)] bg-[rgba(51,192,122,.1)]"
                : "border-transparent",
          )}
        >
          <Avatar name={row.name} size={34} className="shadow-[0_0_0_2px_rgba(255,255,255,.15)]" />
          <span className="min-w-0 flex-1 font-bold">
            <span className="block truncate">{row.name}</span>
            <small
              className={clsx("block min-h-[14px] text-[11px] font-bold", row.status === "guessed" ? "text-rl-ok-text" : "text-rl-muted")}
            >
              <StatusLine row={row} />
            </small>
          </span>
          <span className="font-extrabold tabular-nums">{row.score}</span>
        </div>
      ))}
    </aside>
  );
});
