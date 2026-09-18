import clsx from "clsx";
import { Avatar } from "../../../components/ui/Avatar";
import { T } from "../../../theme/styles/classes";
import { RAYADO_RAINBOW } from "../rainbow";
import type { ScoreboardEntry } from "./Scoreboard";

// El mismo naranja que corona el podio final (PodiumBoard) marca acá a
// quien va primero — así el hilo de color entre "marcador de ronda" y
// "cierre de partida" es el mismo en vez de que uno use el morado genérico
// de S.card y el otro el arcoíris.
const LEADER_ACCENT = RAYADO_RAINBOW[1];

export interface RoundScoreboardEntry extends ScoreboardEntry {
  /** Si está presente, suma un círculo de estado a la fila: verde si ya
   * marcó "listo" para el siguiente turno, gris si todavía no. */
  ready?: boolean;
}

/**
 * Marcador entre turnos (fase "reveal"): variante propia de rayado-libre del
 * listado de puntos — a diferencia del `Scoreboard` genérico compartido con
 * otros juegos, remarca a quien va primero con el color del podio para que
 * este momento ya anticipe la paleta del cierre de partida, y suma el
 * círculo de "listo" en la misma fila en vez de un listado aparte.
 */
export function RoundScoreboard({ entries, title = "Tabla de puntos" }: { entries: RoundScoreboardEntry[]; title?: string }) {
  const ranked = [...entries].sort((a, b) => b.score - a.score);
  return (
    <div className={T.card}>
      <span className={T.label}>{title}</span>
      {ranked.map((e, i) => {
        const leading = i === 0;
        return (
          <div
            key={e.id}
            className={clsx("flex items-center gap-2 rounded-lg py-1.5 px-2", i === 0 ? "mt-0.5" : "mt-0")}
            style={{
              background: leading ? `color-mix(in srgb, ${LEADER_ACCENT} 12%, transparent)` : "transparent",
              borderLeft: leading ? `3px solid ${LEADER_ACCENT}` : "3px solid transparent",
            }}
          >
            <span className="w-4 text-xs font-extrabold" style={{ color: leading ? LEADER_ACCENT : "#6b6490" }}>
              {i + 1}
            </span>
            <Avatar name={e.name} size={22} />
            <span className="flex-1 font-bold text-xs">
              {e.name}
              {e.isMe && " (vos)"}
            </span>
            {!!e.roundPoints && <span className="text-[11px] font-bold text-[#5DCAA5]">+{e.roundPoints}</span>}
            <span className="text-xs font-extrabold" style={{ color: leading ? LEADER_ACCENT : "#5DCAA5" }}>
              {e.score} pts
            </span>
            {e.ready !== undefined && (
              <span
                title={e.ready ? "Listo" : "Todavía no está listo"}
                aria-label={e.ready ? "Listo" : "Todavía no está listo"}
                className={clsx(
                  "w-2.5 h-2.5 rounded-full shrink-0 transition-[background,box-shadow] duration-300 ease-in-out",
                  e.ready ? "bg-[#5DCAA5] shadow-[0_0_0_3px_rgba(93,202,165,0.2)]" : "bg-[#4a4568] shadow-none",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
