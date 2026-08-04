import type { CSSProperties } from "react";
import { Avatar } from "../ui/Avatar";
import { S } from "../../theme/styles";

// Shared by every game's final-results screen (moved here from
// rayado-libre, where it started — see games/rayado-libre/README.md /
// components/README.md for the "2+ real games" bar this cleared). Takes a
// plain list of entries instead of a Room/LocalPlayer[] shape, same
// reasoning as Scoreboard: it shouldn't need to know which mode/game is
// rendering it.
export interface ScoreboardEntry {
  id: string | number;
  name: string;
  score: number;
  // Shows a small "+N" to the left of the total — how much this player
  // gained just this turn, not their overall standing. Omitted (or 0) shows
  // nothing extra. Unused by PodiumBoard itself (final standings show only
  // the total) but kept on the shared type since Scoreboard's rows do use it.
  roundPoints?: number;
  isMe?: boolean;
}

// Oro/plata/bronce por defecto — coincide con el 🥇🥈🥉 que ya usan varias
// pantallas de "fin de partida". Un juego con identidad visual propia (ej.
// rayado-libre, con su propio arcoíris) puede pasar su propia terna vía
// `colors` en vez de quedarse con esta.
const DEFAULT_COLORS: [string, string, string] = ["#E2C44A", "#C0C0C0", "#CD7F32"];
const PODIUM_HEIGHTS = [104, 76, 56];
// Orden visual clásico de podio (2°-1°-3°), no el orden de ranking.
const PODIUM_SLOTS = [1, 0, 2];

/**
 * Tratamiento especial para el cierre de partida: el podio con los primeros
 * 3 puestos (barras con alturas/colores por puesto + confetti + animación
 * de "subida"), más una card "Resto de la tabla" para el resto — en vez del
 * listado plano que alcanza para una ronda intermedia (ver `Scoreboard`,
 * juego por juego, sigue siendo su propia pieza para eso).
 */
export function PodiumBoard({ entries, colors = DEFAULT_COLORS }: { entries: ScoreboardEntry[]; colors?: [string, string, string] }) {
  const ranked = [...entries].sort((a, b) => b.score - a.score);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const confetti = [
    { color: colors[0], left: "8%", top: "4%" },
    { color: colors[1], left: "88%", top: "10%" },
    { color: colors[2], left: "20%", top: "70%" },
    { color: colors[1], left: "78%", top: "2%" },
    { color: colors[0], left: "50%", top: "0%" },
  ];

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .gk-podium-row { display: flex; align-items: flex-end; justify-content: center; gap: 14px; padding: 28px 10px 0; position: relative; }
        .gk-podium-bar { border-radius: 12px 12px 4px 4px; width: 84px; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; color: #fff; font-weight: 800; font-size: 20px; box-shadow: 0 10px 24px -10px rgba(0,0,0,0.5); }
        .gk-podium-confetti { position: absolute; width: 7px; height: 7px; border-radius: 50%; opacity: 0.85; }
        @media (prefers-reduced-motion: no-preference) {
          .gk-podium-bar { animation: gk-podium-rise 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        }
        @keyframes gk-podium-rise { from { transform: scaleY(0); transform-origin: bottom; opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        /* Sobra ancho en desktop en juegos con RoundView ancho (ver
           jt-round-wrap-wide) — el podio escala 40% en vez de quedar del
           mismo tamaño chico pensado para mobile. */
        @media (min-width: 1024px) {
          .gk-podium-row { transform: scale(1.4); transform-origin: center top; margin-bottom: 48px; }
        }
      `}</style>
      {confetti.map((c, i) => (
        <span key={i} className="gk-podium-confetti" style={{ background: c.color, left: c.left, top: c.top }} />
      ))}
      <div className="gk-podium-row">
        {PODIUM_SLOTS.map(rank => {
          const entry = top3[rank];
          if (!entry) return null;
          const barStyle = {
            height: PODIUM_HEIGHTS[rank],
            background: `linear-gradient(180deg, ${colors[rank]}, color-mix(in srgb, ${colors[rank]} 70%, black))`,
            animationDelay: `${rank * 0.08}s`,
          } as CSSProperties;
          return (
            <div key={entry.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Avatar name={entry.name} size={36} />
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  maxWidth: 84,
                  textAlign: "center",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.name}
                {entry.isMe && " (vos)"}
              </p>
              <div className="gk-podium-bar" style={barStyle}>
                {rank + 1}
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: colors[rank] }}>{entry.score} pts</p>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <div style={{ ...S.card, marginTop: 20 }}>
          <span style={S.label}>Resto de la tabla</span>
          {rest.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 4}</span>
              <Avatar name={e.name} size={22} />
              <span style={{ flex: 1, fontWeight: 700, fontSize: 12 }}>
                {e.name}
                {e.isMe && " (vos)"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#5DCAA5" }}>{e.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
