import { useEffect, useRef, useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import type { RoundViewProps } from "../gameTypes";

interface Entry {
  id: string;
  name: string;
  description: string;
}

interface RuletaRoundState {
  mode: "keep" | "eliminate";
  entries: Entry[];
  pool: Entry[];
  rotation: number;
  result: Entry | null;
  spinAt: number | null;
  spinMs: number;
  eliminated: Entry[];
  counts: Record<string, number>;
}

const COLORS = ["#7F77DD", "#5DCAA5", "#EF9F27", "#F09595", "#4A9FE0", "#C77DE0", "#E0C24A", "#6BD1C0"];

function polar(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function slicePath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const [x1, y1] = polar(cx, cy, r, startAngle);
  const [x2, y2] = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

// Ronda online: el servidor decide cada giro y guarda la rotación acumulada
// para que la animación sea igual en todas las pantallas. Solo el anfitrión
// puede girar / confirmar; el resto ve la rueda en modo lectura.
export function RoundView({ room, isHost, send }: RoundViewProps) {
  const round = room.round as unknown as RuletaRoundState | null;
  const [showStats, setShowStats] = useState(false);
  // Puramente local: arranca al detectar un spinAt nuevo (venga de un mensaje
  // propio o del broadcast al resto de la sala) y se apaga solo a los
  // spinMs, sin comparar contra Date.now() del servidor — comparar relojes
  // de dispositivos distintos es justo lo que hacía que el resto de la sala
  // nunca viera al anfitrión girar (su reloj podía estar adelantado/atrasado
  // respecto al del servidor y "spinning" daba false desde el primer render).
  const [spinning, setSpinning] = useState(false);
  const lastSpinAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (round?.spinAt && round.spinAt !== lastSpinAtRef.current) {
      lastSpinAtRef.current = round.spinAt;
      setSpinning(true);
      const t = setTimeout(() => setSpinning(false), round.spinMs);
      return () => clearTimeout(t);
    }
    if (!round?.spinAt) {
      lastSpinAtRef.current = null;
      setSpinning(false);
    }
  }, [round?.spinAt, round?.spinMs]);

  if (!round) return null;

  const size = 300;
  const r = size / 2;
  const finished = room.phase === "result" || (round.mode === "eliminate" && round.pool.length < 2);
  const showResult = round.result && !spinning;

  return (
    <div>
      {/* Con una sola entrada en el pool, un slice de 360° es un arco
          degenerado (el punto de inicio y fin coinciden) y no dibuja nada —
          se ve como una rueda negra. En vez de forzarlo, cuando ya está
          decidido el ganador se oculta la rueda y se muestra el cartel. */}
      {!finished && (
        <div style={{ position: "relative", width: size, maxWidth: "100%", margin: "0 auto 20px" }}>
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
              width: 0,
              height: 0,
              borderLeft: "12px solid transparent",
              borderRight: "12px solid transparent",
              borderTop: "20px solid #EF9F27",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
            }}
          />
          <div
            style={{
              width: size,
              height: size,
              maxWidth: "100%",
              aspectRatio: "1/1",
              borderRadius: "50%",
              border: "4px solid rgba(127,119,221,0.4)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <svg
              viewBox={`0 0 ${size} ${size}`}
              width="100%"
              height="100%"
              style={{ transform: `rotate(${round.rotation}deg)`, transition: `transform ${round.spinMs}ms cubic-bezier(0.17, 0.67, 0.2, 1)` }}
            >
              {round.pool.length === 0 ? (
                <circle cx={r} cy={r} r={r} fill="rgba(255,255,255,0.06)" />
              ) : (
                round.pool.map((e, i) => {
                  const seg = 360 / round.pool.length;
                  const start = i * seg;
                  const end = start + seg;
                  const mid = start + seg / 2;
                  const [lx, ly] = polar(r, r, r * 0.62, mid);
                  return (
                    <g key={e.id}>
                      <path d={slicePath(r, r, r, start, end)} fill={COLORS[i % COLORS.length]} stroke="#0f0c1d" strokeWidth={2} />
                      <text
                        x={lx}
                        y={ly}
                        fill="#0f0c1d"
                        fontSize={round.pool.length > 10 ? 9 : 12}
                        fontWeight={800}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${mid}, ${lx}, ${ly})`}
                      >
                        {e.name.length > 14 ? e.name.slice(0, 13) + "…" : e.name}
                      </text>
                    </g>
                  );
                })
              )}
            </svg>
          </div>
        </div>
      )}

      {!finished && !showResult && isHost && (
        <Btn
          variant="success"
          onClick={() => send({ type: "spin" })}
          disabled={spinning || round.pool.length < 2}
          style={{ marginBottom: 14 }}
        >
          {spinning ? "Girando..." : "🎡 Girar la ruleta"}
        </Btn>
      )}
      {!finished && !showResult && !isHost && (
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 14 }}>
          {spinning ? "Girando..." : "Esperando que el anfitrión gire la ruleta"}
        </p>
      )}

      {showResult && round.result && (
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#7F77DD",
              margin: "0 0 6px",
            }}
          >
            Salió
          </p>
          <p style={S.bigReveal}>{round.result.name}</p>
          {round.result.description && <p style={{ fontSize: 14, color: "#e8e4f0", margin: "8px 0 0" }}>{round.result.description}</p>}

          {isHost ? (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {round.mode === "eliminate" ? (
                <Btn variant="success" onClick={() => send({ type: "confirm_eliminate" })}>
                  Continuar
                </Btn>
              ) : (
                <Btn variant="success" onClick={() => send({ type: "spin_again" })}>
                  Girar de nuevo
                </Btn>
              )}
            </div>
          ) : (
            <p style={{ ...S.muted, marginTop: 16 }}>Esperando al anfitrión</p>
          )}
        </div>
      )}

      {finished && round.pool.length > 0 && (
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 4px" }}>🏆</p>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#7F77DD",
              margin: "0 0 6px",
            }}
          >
            Ganador
          </p>
          <p style={S.bigReveal}>{round.pool[0].name}</p>
          {round.pool[0].description && <p style={{ fontSize: 14, color: "#e8e4f0", margin: "8px 0 0" }}>{round.pool[0].description}</p>}
        </div>
      )}

      {round.mode === "eliminate" && round.eliminated.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>Orden de eliminación</span>
          {round.eliminated.map((e, i) => (
            <div
              key={e.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 0",
                borderBottom: i < round.eliminated.length - 1 ? "1px solid rgba(127,119,221,0.1)" : "none",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(226,75,74,0.15)",
                  color: "#F09595",
                  fontSize: 11,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
            </div>
          ))}
        </div>
      )}

      {round.mode === "keep" && Object.keys(round.counts).length > 0 && (
        <div style={S.card}>
          <button onClick={() => setShowStats(v => !v)} style={{ ...S.btn("ghost"), justifyContent: "space-between" }}>
            <span>Ver cuántas veces salió cada opción</span>
            <span>{showStats ? "▲" : "▼"}</span>
          </button>
          {showStats && (
            <div style={{ marginTop: 12 }}>
              {[...round.entries]
                .sort((a, b) => (round.counts[b.id] || 0) - (round.counts[a.id] || 0))
                .map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {e.name}
                    </span>
                    <span style={S.pill(!!round.counts[e.id])}>{round.counts[e.id] || 0}×</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {finished && isHost && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <Btn variant="success" onClick={() => send({ type: "start_round" })}>
            Jugar de nuevo
          </Btn>
          {room.groupCode === null && (
            <Btn variant="ghost" onClick={() => send({ type: "back_to_lobby" })}>
              Volver al lobby
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}
