import { Avatar } from "../../../components/ui/Avatar";
import { S } from "../../../theme/styles";
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
    <div style={S.card}>
      <span style={S.label}>{title}</span>
      {ranked.map((e, i) => {
        const leading = i === 0;
        return (
          <div
            key={e.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 8,
              marginTop: i === 0 ? 2 : 0,
              background: leading ? `color-mix(in srgb, ${LEADER_ACCENT} 12%, transparent)` : "transparent",
              borderLeft: leading ? `3px solid ${LEADER_ACCENT}` : "3px solid transparent",
            }}
          >
            <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: leading ? LEADER_ACCENT : "#6b6490" }}>{i + 1}</span>
            <Avatar name={e.name} size={22} />
            <span style={{ flex: 1, fontWeight: 700, fontSize: 12 }}>
              {e.name}
              {e.isMe && " (vos)"}
            </span>
            {!!e.roundPoints && <span style={{ fontSize: 11, fontWeight: 700, color: "#5DCAA5" }}>+{e.roundPoints}</span>}
            <span style={{ fontSize: 12, fontWeight: 800, color: leading ? LEADER_ACCENT : "#5DCAA5" }}>{e.score} pts</span>
            {e.ready !== undefined && (
              <span
                title={e.ready ? "Listo" : "Todavía no está listo"}
                aria-label={e.ready ? "Listo" : "Todavía no está listo"}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: e.ready ? "#5DCAA5" : "#4a4568",
                  boxShadow: e.ready ? "0 0 0 3px rgba(93,202,165,0.2)" : "none",
                  transition: "background 0.3s ease, box-shadow 0.3s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
