import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { TabRow } from "../../components/setup/TabRow";
import { StickyActionBar } from "../../components/setup/StickyActionBar";
import { StartButton } from "../../components/setup/StartButton";
import { ConfirmBackButton } from "../../components/game-kit/ConfirmBackButton";
import { EntriesEditor } from "./components/EntriesEditor";
import { ModeSelector } from "./components/ModeSelector";

// ═══════════════════════════════════════════════════════════════════════════════
// RULETA — cargás entradas (un nombre, y opcionalmente una descripción más larga
// para usar como "prenda"/castigo) y girás una ruleta de verdad (SVG, con inercia
// y desaceleración). Dos modos: eliminación (la entrada que sale se saca de la
// ruleta) o repetir (se mantienen todas y podés girar cuantas veces quieras).
// ═══════════════════════════════════════════════════════════════════════════════

interface Entry {
  id: number;
  name: string;
  description: string;
}

const COLORS = ["#7F77DD", "#5DCAA5", "#EF9F27", "#F09595", "#4A9FE0", "#C77DE0", "#E0C24A", "#6BD1C0"];
const SPIN_MS = 4200;

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

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "wheel">("setup");
  const [setupTab, setSetupTab] = useState<"entries" | "mode">("entries");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [mode, setMode] = useState<"keep" | "eliminate">("keep");

  const [pool, setPool] = useState<Entry[]>([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Entry | null>(null);
  const [eliminated, setEliminated] = useState<Entry[]>([]); // orden de eliminación (modo eliminate)
  const [counts, setCounts] = useState<Record<number, number>>({}); // id -> veces que salió (modo keep)
  const [showStats, setShowStats] = useState(false);
  const rotationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Date.now() has ~1ms resolution — a fast double-submit (Enter + button
  // both firing) could hand two entries the same id, and removeEntry's
  // filter(id !== ...) would then remove both at once instead of one.
  // A simple incrementing counter can't collide.
  const nextEntryId = useRef(1);

  const addEntry = (name: string, description: string) => setEntries(prev => [...prev, { id: nextEntryId.current++, name, description }]);

  const removeEntry = (id: number) => setEntries(prev => prev.filter(e => e.id !== id));

  const startWheel = () => {
    setPool(entries);
    setRotation(0);
    rotationRef.current = 0;
    setResult(null);
    setEliminated([]);
    setCounts({});
    setShowStats(false);
    setPhase("wheel");
  };

  const spin = () => {
    if (spinning || pool.length < 2) return;
    setSpinning(true);
    setResult(null);
    const idx = Math.floor(Math.random() * pool.length);
    const seg = 360 / pool.length;
    const center = idx * seg + seg / 2;
    const targetMod = (360 - center + 360) % 360;
    const currentMod = ((rotationRef.current % 360) + 360) % 360;
    const extra = (targetMod - currentMod + 360) % 360;
    const spins = 5 * 360;
    const next = rotationRef.current + spins + extra;
    rotationRef.current = next;
    setRotation(next);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSpinning(false);
      const winner = pool[idx];
      setResult(winner);
      if (mode === "keep") {
        setCounts(prev => ({ ...prev, [winner.id]: (prev[winner.id] || 0) + 1 }));
      }
    }, SPIN_MS);
  };

  const confirmEliminate = () => {
    if (!result) return;
    setPool(prev => prev.filter(e => e.id !== result.id));
    setEliminated(prev => [...prev, result]);
    setResult(null);
  };

  const spinAgain = () => setResult(null);

  const size = 300;
  const r = size / 2;

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div style={{ paddingBottom: 88 }}>
        <TabRow
          tabs={[
            { key: "entries", label: "Entradas" },
            { key: "mode", label: "Modo" },
          ]}
          active={setupTab}
          onChange={setSetupTab}
          className="mb-3.5"
        />

        {setupTab === "entries" && <EntriesEditor entries={entries} onAdd={addEntry} onRemove={removeEntry} />}

        {setupTab === "mode" && (
          <ModeSelector mode={mode} onChange={setMode} keepLabel="Repetir — se mantienen todas las entradas, girá las veces que quieras" />
        )}

        <StickyActionBar>
          <StartButton onClick={startWheel} disabled={entries.length < 2}>
            Empezar a girar
          </StartButton>
          {entries.length < 2 && <p className={clsx(T.muted, "text-center mt-2")}>Cargá al menos 2 entradas</p>}
        </StickyActionBar>
      </div>
    );

  // ── WHEEL ──
  const finished = mode === "eliminate" && pool.length < 2;

  return (
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
              style={{ "--jt-wheel-rotation": `${rotation}deg` } as CSSProperties}
              className="rotate-[var(--jt-wheel-rotation)] transition-transform duration-[4200ms] ease-[cubic-bezier(0.17,0.67,0.2,1)]"
            >
              {pool.length === 0 ? (
                <circle cx={r} cy={r} r={r} fill="rgba(255,255,255,0.06)" />
              ) : (
                pool.map((e, i) => {
                  const seg = 360 / pool.length;
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
                        fontSize={pool.length > 10 ? 9 : 12}
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

      {!finished && !result && (
        <Btn variant="success" onClick={spin} disabled={spinning || pool.length < 2} className="mb-3.5">
          {spinning ? "Girando..." : "🎡 Girar la ruleta"}
        </Btn>
      )}

      {result && (
        <div className={clsx(T.cardHighlight, "text-center")}>
          <p className={T.wheelEyebrow}>Salió</p>
          <p className={T.bigReveal}>{result.name}</p>
          {result.description && <p className="mt-2 text-sm text-[#e8e4f0]">{result.description}</p>}

          <div className="mt-4 flex gap-2">
            {mode === "eliminate" ? (
              <StartButton onClick={confirmEliminate}>Continuar</StartButton>
            ) : (
              <StartButton onClick={spinAgain}>Girar de nuevo</StartButton>
            )}
          </div>
        </div>
      )}

      {finished && (
        <div className={clsx(T.cardHighlight, "text-center mb-3.5")}>
          <p className={T.wheelTrophy}>🏆</p>
          <p className={T.wheelEyebrow}>Ganador</p>
          <p className={T.bigReveal}>{pool[0].name}</p>
          {pool[0].description && <p className="mt-2 text-sm text-[#e8e4f0]">{pool[0].description}</p>}
        </div>
      )}

      {mode === "eliminate" && eliminated.length > 0 && (
        <div className={T.card}>
          <span className={T.label}>Orden de eliminación</span>
          <div className="divide-y divide-[rgba(127,119,221,0.1)]">
            {eliminated.map((e, i) => (
              <div key={e.id} className="flex items-center gap-2.5 py-1.5">
                <span className={T.wheelBadge}>{i + 1}</span>
                <span className="text-[13px] font-bold">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === "keep" && Object.keys(counts).length > 0 && (
        <div className={T.card}>
          <button onClick={() => setShowStats(v => !v)} className={clsx(T.btn("ghost"), "justify-between")}>
            <span>Ver cuántas veces salió cada opción</span>
            <span>{showStats ? "▲" : "▼"}</span>
          </button>
          {showStats && (
            <div className="mt-3">
              {[...entries]
                .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
                .map(e => (
                  <div key={e.id} className="flex items-center gap-2.5 py-1.5">
                    <span className={clsx("min-w-0 flex-1 text-[13px] font-bold", T.truncateLabel)}>{e.name}</span>
                    <span className={T.pill(!!counts[e.id])}>{counts[e.id] || 0}×</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <ConfirmBackButton
        title="¿Volver a cargar entradas?"
        message={
          spinning
            ? "La rueda todavía está girando — volver ahora corta la animación a mitad de camino."
            : "Se pierde el progreso de esta rueda (eliminaciones y conteos ya hechos) para poder cargar entradas de nuevo."
        }
        confirmLabel="Volver"
        onConfirm={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setPhase("setup");
        }}
      >
        Volver a cargar entradas
      </ConfirmBackButton>
    </div>
  );
}
