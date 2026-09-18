import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
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
  // Covers the round-trip gap between tapping "Girar" and the server's
  // spinAt actually coming back — without it, a double-tap (or the host's
  // own network just being slow) can fire a second "spin" before the first
  // reply lands, which the engine silently rejects with nothing to show for
  // it. Cleared as soon as the real spinAt arrives (or immediately if the
  // request gets rejected and nothing ever starts spinning).
  const [sending, setSending] = useState(false);
  const lastSpinAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (round?.spinAt && round.spinAt !== lastSpinAtRef.current) {
      lastSpinAtRef.current = round.spinAt;
      setSpinning(true);
      setSending(false);
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
  // room.phase flips to "result" the instant confirm_eliminate decides the
  // match (see engine.ts's maybeAdvance, called synchronously right after)
  // — the only authoritative source by the time any client sees it, so no
  // need to also re-derive "finished" from pool.length as a fallback.
  const finished = room.phase === "result";
  const showResult = round.result && !spinning;
  const hostPlayer = room.players.find(p => p.id === room.hostId);
  // Cuántos giros ya se confirmaron esta sesión — se deriva de los datos que
  // ya llegan (no hace falta un contador nuevo en el server): en "eliminar"
  // son las entradas ya sacadas de la ruleta, en "repetir" es la suma de
  // cuántas veces salió cada una. El giro en curso (round.result todavía sin
  // confirmar) se suma aparte solo para mostrar su número de orden.
  const settledSpins = round.mode === "eliminate" ? round.eliminated.length : Object.values(round.counts).reduce((a, b) => a + b, 0);

  return (
    // Keyed en settledSpins (giros ya confirmados), no en el giro en curso —
    // un giro en marcha setea round.result de inmediato, y remontar el árbol
    // justo ahí mataría la transición CSS propia de la rueda a mitad de la
    // animación. Usando solo el conteo asentado, el fade-in se repite recién
    // cuando un giro se confirma (confirm_eliminate/spin_again) o al pasar
    // a la pantalla de resultado final, nunca mientras la rueda está girando.
    <PhaseTransition phaseKey={`spin-${settledSpins}-${finished}`}>
      <div>
        {/* Con una sola entrada en el pool, un slice de 360° es un arco
          degenerado (el punto de inicio y fin coinciden) y no dibuja nada —
          se ve como una rueda negra. En vez de forzarlo, cuando ya está
          decidido el ganador se oculta la rueda y se muestra el cartel. */}
        {!finished && (
          <div className={T.wheelWrap}>
            <div className={T.wheelPointer} />
            <div className={T.wheelDisc}>
              <svg
                viewBox={`0 0 ${size} ${size}`}
                width="100%"
                height="100%"
                style={
                  {
                    "--jt-wheel-rotation": `${round.rotation}deg`,
                    "--jt-wheel-spin-ms": `${round.spinMs}ms`,
                  } as CSSProperties
                }
                className="rotate-[var(--jt-wheel-rotation)] transition-transform duration-[var(--jt-wheel-spin-ms)] ease-[cubic-bezier(0.17,0.67,0.2,1)]"
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

        {!finished && <p className="mb-2 text-center text-[13px] text-[#9089c0]">Giro {settledSpins + 1}</p>}

        {!finished && !showResult && isHost && (
          <Btn
            variant="success"
            onClick={() => {
              setSending(true);
              send({ type: "spin" });
              // A silently-rejected spin (pool changed underneath, or lost a
              // race with another click) never produces a new spinAt, which
              // would otherwise leave the button disabled forever — clear the
              // guard after a generous round-trip window regardless.
              setTimeout(() => setSending(false), 2000);
            }}
            disabled={spinning || sending || round.pool.length < 2}
            className="mb-3.5"
          >
            {spinning ? "Girando..." : "🎡 Girar la ruleta"}
          </Btn>
        )}
        {!finished && !showResult && !isHost && (
          <p className={clsx(T.muted, "text-center mb-3.5")}>
            {spinning ? "Girando..." : `Esperando que ${hostPlayer ? hostPlayer.name : "el anfitrión"} gire la ruleta`}
          </p>
        )}

        {showResult && round.result && (
          <div className={clsx(T.cardHighlight, "text-center")}>
            <p className={T.wheelEyebrow}>Salió</p>
            <p className={T.bigReveal}>{round.result.name}</p>
            {round.result.description && <p className="mt-2 text-sm text-[#e8e4f0]">{round.result.description}</p>}

            {isHost ? (
              <div className="mt-4 flex gap-2">
                {round.mode === "eliminate" ? (
                  <StartButton onClick={() => send({ type: "confirm_eliminate" })}>Continuar</StartButton>
                ) : (
                  <StartButton onClick={() => send({ type: "spin_again" })}>Girar de nuevo</StartButton>
                )}
              </div>
            ) : (
              <p className={clsx(T.muted, "mt-4")}>Esperando al anfitrión</p>
            )}
          </div>
        )}

        {finished && round.pool.length > 0 && (
          <div className={clsx(T.cardHighlight, "text-center")}>
            <p className={T.wheelTrophy}>🏆</p>
            <p className={T.wheelEyebrow}>Ganador</p>
            <p className={T.bigReveal}>{round.pool[0].name}</p>
            {round.pool[0].description && <p className="mt-2 text-sm text-[#e8e4f0]">{round.pool[0].description}</p>}
          </div>
        )}

        {round.mode === "eliminate" && round.eliminated.length > 0 && (
          <div className={T.card}>
            <span className={T.label}>Orden de eliminación</span>
            <div className="divide-y divide-[rgba(127,119,221,0.1)]">
              {round.eliminated.map((e, i) => (
                <div key={e.id} className="flex items-center gap-2.5 py-1.5">
                  <span className={T.wheelBadge}>{i + 1}</span>
                  <span className="text-[13px] font-bold">{e.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {round.mode === "keep" && Object.keys(round.counts).length > 0 && (
          <div className={T.card}>
            <button onClick={() => setShowStats(v => !v)} className={clsx(T.btn("ghost"), "justify-between")}>
              <span>Ver cuántas veces salió cada opción</span>
              <span>{showStats ? "▲" : "▼"}</span>
            </button>
            {showStats && (
              <div className="mt-3">
                {[...round.entries]
                  .sort((a, b) => (round.counts[b.id] || 0) - (round.counts[a.id] || 0))
                  .map(e => (
                    <div key={e.id} className="flex items-center gap-2.5 py-1.5">
                      <span className={clsx("min-w-0 flex-1 text-[13px] font-bold", T.truncateLabel)}>{e.name}</span>
                      <span className={T.pill(!!round.counts[e.id])}>{round.counts[e.id] || 0}×</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {finished && isHost && <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>}
        {/* Mismo botón que el modo local (setPhase("setup")) — siempre
          disponible, no solo cuando termina la rueda, así cualquiera puede
          volver a la carga de entradas (que ahora vive en la pestaña
          "Configuración" del lobby) en cualquier momento, no solo el
          anfitrión. En un grupo no aplica: el grupo tiene su propio "Volver
          al grupo" en el shell. */}
        <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
      </div>
    </PhaseTransition>
  );
}
