import type { CSSProperties } from "react";
import { Avatar } from "../../../components/ui/Avatar";
import { S } from "../../../theme/styles";
import type { ScoreboardEntry } from "./Scoreboard";
import { RAYADO_RAINBOW } from "../rainbow";

// 1° naranja, 2° azul, 3° violeta (índices 1/3/4 del anillo) — para que el
// cierre de partida se sienta parte de la misma paleta en vez de reciclar
// el morado genérico de S.card.
const PODIUM_COLORS = [RAYADO_RAINBOW[1], RAYADO_RAINBOW[3], RAYADO_RAINBOW[4]];
const PODIUM_HEIGHTS = [104, 76, 56];
// Orden visual clásico de podio (2°-1°-3°), no el orden de ranking.
const PODIUM_SLOTS = [1, 0, 2];

const CONFETTI = [
  { color: RAYADO_RAINBOW[0], left: "8%", top: "4%" },
  { color: RAYADO_RAINBOW[3], left: "88%", top: "10%" },
  { color: RAYADO_RAINBOW[2], left: "20%", top: "70%" },
  { color: RAYADO_RAINBOW[1], left: "78%", top: "2%" },
  { color: RAYADO_RAINBOW[4], left: "50%", top: "0%" },
];

/**
 * Tratamiento especial para el cierre de partida (fase "result"): el podio
 * con los primeros 3 puestos, en vez del listado plano de `Scoreboard` que
 * usa cada ronda intermedia — ese sigue siendo el genérico compartido con
 * otros juegos; este es propio de rayado-libre, solo para este momento.
 */
export function PodiumBoard({ entries }: { entries: ScoreboardEntry[] }) {
  const ranked = [...entries].sort((a, b) => b.score - a.score);
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div style={{ position: "relative" }}>
      <style>{`
        .rl-podium-row { display: flex; align-items: flex-end; justify-content: center; gap: 14px; padding: 28px 10px 0; position: relative; }
        .rl-podium-bar { border-radius: 12px 12px 4px 4px; width: 84px; display: flex; align-items: flex-start; justify-content: center; padding-top: 8px; color: #fff; font-weight: 800; font-size: 20px; box-shadow: 0 10px 24px -10px rgba(0,0,0,0.5); }
        .rl-podium-confetti { position: absolute; width: 7px; height: 7px; border-radius: 50%; opacity: 0.85; }
        @media (prefers-reduced-motion: no-preference) {
          .rl-podium-bar { animation: rl-podium-rise 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        }
        @keyframes rl-podium-rise { from { transform: scaleY(0); transform-origin: bottom; opacity: 0; } to { transform: scaleY(1); opacity: 1; } }
        /* Sobra ancho en desktop (el RoundView de este juego usa hasta
           1040px, ver jt-round-wrap-wide) — el podio escala 40% en vez de
           quedar del mismo tamaño chico pensado para mobile. */
        @media (min-width: 1024px) {
          .rl-podium-row { transform: scale(1.4); transform-origin: center top; margin-bottom: 48px; }
        }
      `}</style>
      {CONFETTI.map((c, i) => (
        <span key={i} className="rl-podium-confetti" style={{ background: c.color, left: c.left, top: c.top }} />
      ))}
      <div className="rl-podium-row">
        {PODIUM_SLOTS.map(rank => {
          const entry = top3[rank];
          if (!entry) return null;
          const barStyle = {
            height: PODIUM_HEIGHTS[rank],
            background: `linear-gradient(180deg, ${PODIUM_COLORS[rank]}, color-mix(in srgb, ${PODIUM_COLORS[rank]} 70%, black))`,
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
              <div className="rl-podium-bar" style={barStyle}>
                {rank + 1}
              </div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: PODIUM_COLORS[rank] }}>{entry.score} pts</p>
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
