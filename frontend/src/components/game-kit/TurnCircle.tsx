import { Avatar } from "../ui/Avatar";
import { DEFAULT_COLORS } from "../../theme/styles/colors";

interface TurnCirclePlayer {
  id: string;
  name: string;
  online?: boolean;
}

export type TurnCircleOutcome = "solved" | "eliminated" | "conceded";

const OUTCOME_STYLE: Record<TurnCircleOutcome, { color: string; badge: string }> = {
  solved: { color: "#5DCAA5", badge: "✓" },
  eliminated: { color: "#F09595", badge: "✕" },
  conceded: { color: "#F09595", badge: "🏳️" },
};

// With a handful of players the circle stays exactly as it always looked;
// past that, avatars/labels shrink and the ring grows so a big roster (16+)
// doesn't turn into an overlapping pile — chord length between neighboring
// avatars only gets tight enough to collide once you're well past what a
// pass-and-play group of that size can even fit in a room anyway.
function scaleFor(n: number) {
  if (n <= 6) return { size: 260, radius: 96, avatar: 44, font: 11, labelWidth: 68, badge: 16 };
  if (n <= 8) return { size: 280, radius: 108, avatar: 38, font: 10, labelWidth: 60, badge: 15 };
  if (n <= 10) return { size: 300, radius: 122, avatar: 32, font: 10, labelWidth: 52, badge: 13 };
  if (n <= 13) return { size: 320, radius: 136, avatar: 26, font: 9, labelWidth: 44, badge: 12 };
  return { size: 340, radius: 148, avatar: 22, font: 8, labelWidth: 38, badge: 11 };
}

/**
 * El orden de turno de la ronda dispuesto como un círculo: a quien le toca
 * el turno brilla, los jugadores que ya jugaron esta vuelta quedan
 * atenuados con un tilde, y el resto espera su turno — así queda
 * visualmente obvio a quién le toca sin tener que leer una lista de
 * nombres. Originalmente era un componente propio del `RoundView` de
 * Impostor, se promovió acá para que cualquier juego por turnos pueda
 * reutilizar el mismo visual de "a quién le toca" en vez de
 * reimplementarlo (ver `games/quien-soy` para otro uso de esto, tanto
 * online como local pasa-y-juega).
 *
 * `outcomes` (opcional) es para juegos como ¿Quién Soy? donde un jugador
 * puede salirse de la rotación a mitad de ronda (resuelto/eliminado/
 * rendido) — en vez de desaparecer del círculo, se queda en su lugar
 * original con un anillo/insignia de color según cómo terminó, en vez del
 * estilo normal de actual/ya-jugó.
 */
export function TurnCircle({
  turnOrder,
  turnIndex,
  players,
  meId,
  outcomes,
}: {
  turnOrder: string[];
  turnIndex: number;
  players: TurnCirclePlayer[];
  meId: string | undefined;
  outcomes?: Record<string, TurnCircleOutcome>;
}) {
  const ordered = turnOrder.map(id => players.find(p => p.id === id)).filter((p): p is TurnCirclePlayer => Boolean(p));
  const n = ordered.length;
  const current = ordered[turnIndex];
  const { size, radius, avatar, font, labelWidth, badge } = scaleFor(n);
  const center = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto 12px" }}>
      {ordered.map((p, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        const x = center + radius * Math.cos(angle);
        const y = center + radius * Math.sin(angle);
        const outcome = outcomes?.[p.id];
        const isCurrent = !outcome && i === turnIndex;
        const hasGone = !outcome && i < turnIndex;
        const isMe = p.id === meId;
        return (
          <div
            key={p.id}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              width: labelWidth,
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: "50%",
                padding: 3,
                border: outcome
                  ? `2px solid ${OUTCOME_STYLE[outcome].color}`
                  : isCurrent
                    ? "2px solid #5DCAA5"
                    : hasGone
                      ? "2px solid var(--jt-accent-border-soft, rgba(127,119,221,0.45))"
                      : "2px solid transparent",
                boxShadow: isCurrent ? "0 0 14px rgba(93,202,165,0.55)" : "none",
                opacity: outcome ? 0.7 : p.online === false ? 0.4 : hasGone && !isCurrent ? 0.55 : 1,
                transition: "all 0.2s",
              }}
            >
              <Avatar name={p.name} size={avatar} />
              {outcome ? (
                <span
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    background: OUTCOME_STYLE[outcome].color,
                    color: "#0f0c1d",
                    borderRadius: "50%",
                    width: badge,
                    height: badge,
                    fontSize: badge - 7,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {OUTCOME_STYLE[outcome].badge}
                </span>
              ) : p.online === false ? (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    background: "var(--jt-muted-text)",
                    color: "#fff",
                    borderRadius: "50%",
                    width: badge,
                    height: badge,
                    fontSize: badge - 7,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ⏸
                </span>
              ) : (
                hasGone && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      background: "#5DCAA5",
                      color: "#0f0c1d",
                      borderRadius: "50%",
                      width: badge,
                      height: badge,
                      fontSize: badge - 6,
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✓
                  </span>
                )
              )}
            </div>
            <span
              style={{
                fontSize: font,
                fontWeight: isCurrent ? 800 : 600,
                color: outcome
                  ? OUTCOME_STYLE[outcome].color
                  : p.online === false
                    ? "var(--jt-muted-text)"
                    : isCurrent
                      ? "#5DCAA5"
                      : isMe
                        ? "#fff"
                        : "var(--jt-muted-text)",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: labelWidth,
              }}
            >
              {isMe ? "Vos" : p.name}
              {p.online === false && !outcome ? " (desc.)" : ""}
            </span>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: center, top: center, transform: "translate(-50%, -50%)", textAlign: "center" }}>
        <p style={{ fontSize: 11, color: "var(--jt-muted-text)", margin: 0 }}>Turno de</p>
        <p
          style={{
            fontSize: n > 10 ? 13 : 15,
            fontWeight: 800,
            color: `var(--jt-accent-strong, ${DEFAULT_COLORS.accentStrong})`,
            margin: 0,
            maxWidth: Math.max(60, 2 * (radius - avatar)),
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {current?.name ?? "—"}
        </p>
      </div>
    </div>
  );
}
