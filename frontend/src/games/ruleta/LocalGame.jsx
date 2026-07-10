import { useRef, useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";

// ═══════════════════════════════════════════════════════════════════════════════
// RULETA — cargás entradas (un nombre, y opcionalmente una descripción más larga
// para usar como "prenda"/castigo) y girás una ruleta de verdad (SVG, con inercia
// y desaceleración). Dos modos: eliminación (la entrada que sale se saca de la
// ruleta) o repetir (se mantienen todas y podés girar cuantas veces quieras).
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = ["#7F77DD", "#5DCAA5", "#EF9F27", "#F09595", "#4A9FE0", "#C77DE0", "#E0C24A", "#6BD1C0"];
const SPIN_MS = 4200;

function polar(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function slicePath(cx, cy, r, startAngle, endAngle) {
  const [x1, y1] = polar(cx, cy, r, startAngle);
  const [x2, y2] = polar(cx, cy, r, endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

export function LocalGame() {
  const [phase, setPhase] = useState("setup"); // setup | wheel
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [mode, setMode] = useState("keep"); // keep | eliminate

  const [pool, setPool] = useState([]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [eliminated, setEliminated] = useState([]); // orden de eliminación (modo eliminate)
  const [counts, setCounts] = useState({}); // id -> veces que salió (modo keep)
  const [showStats, setShowStats] = useState(false);
  const rotationRef = useRef(0);
  const timerRef = useRef(null);

  const addEntry = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setEntries(prev => [...prev, { id: Date.now(), name: trimmed, description: desc.trim() }]);
    setName("");
    setDesc("");
  };

  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id));

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

    clearTimeout(timerRef.current);
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
  if (phase === "setup") return (
    <div>
      <div style={S.card}>
        <span style={S.label}>Entradas ({entries.length})</span>
        {entries.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{e.name}</p>
              {e.description && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9089c0" }}>{e.description}</p>}
            </div>
            <button onClick={() => removeEntry(e.id)} style={{ ...S.btn("danger"), width: 32, height: 32, padding: 0, borderRadius: 8, flexShrink: 0 }}>×</button>
          </div>
        ))}

        <input style={{ ...S.input, marginBottom: 8 }} placeholder="Nombre (ej: Juan, o 'Prenda 1')" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) addEntry(); }} />
        <textarea style={{ ...S.input, marginBottom: 8, resize: "vertical", minHeight: 60 }} placeholder="Descripción / castigo (opcional)" value={desc} onChange={e => setDesc(e.target.value)} />
        <Btn variant="default" onClick={addEntry}>Agregar a la ruleta</Btn>
      </div>

      <div style={S.card}>
        <span style={S.label}>Modo</span>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 10 }} onClick={() => setMode("keep")}>
          <input type="radio" readOnly checked={mode === "keep"} />
          <span style={{ fontSize: 13 }}>Repetir — se mantienen todas las entradas, girá las veces que quieras</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setMode("eliminate")}>
          <input type="radio" readOnly checked={mode === "eliminate"} />
          <span style={{ fontSize: 13 }}>Eliminación — la que sale se saca de la ruleta</span>
        </label>
      </div>

      <Btn onClick={startWheel} disabled={entries.length < 2}>Empezar a girar</Btn>
      {entries.length < 2 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Cargá al menos 2 entradas</p>}
    </div>
  );

  // ── WHEEL ──
  const finished = mode === "eliminate" && pool.length < 2;

  return (
    <div>
      <div style={{ position: "relative", width: size, maxWidth: "100%", margin: "0 auto 20px" }}>
        <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", zIndex: 2, width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "20px solid #EF9F27", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }} />
        <div style={{ width: size, height: size, maxWidth: "100%", aspectRatio: "1/1", borderRadius: "50%", border: "4px solid rgba(127,119,221,0.4)", boxShadow: "0 8px 30px rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <svg
            viewBox={`0 0 ${size} ${size}`}
            width="100%" height="100%"
            style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.2, 1)` }}
          >
            {pool.length === 0 ? (
              <circle cx={r} cy={r} r={r} fill="rgba(255,255,255,0.06)" />
            ) : pool.map((e, i) => {
              const seg = 360 / pool.length;
              const start = i * seg;
              const end = start + seg;
              const mid = start + seg / 2;
              const [lx, ly] = polar(r, r, r * 0.62, mid);
              return (
                <g key={e.id}>
                  <path d={slicePath(r, r, r, start, end)} fill={COLORS[i % COLORS.length]} stroke="#0f0c1d" strokeWidth={2} />
                  <text
                    x={lx} y={ly}
                    fill="#0f0c1d" fontSize={pool.length > 10 ? 9 : 12} fontWeight={800}
                    textAnchor="middle" dominantBaseline="middle"
                    transform={`rotate(${mid}, ${lx}, ${ly})`}
                  >
                    {e.name.length > 14 ? e.name.slice(0, 13) + "…" : e.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {!finished && !result && (
        <Btn variant="success" onClick={spin} disabled={spinning || pool.length < 2}>
          {spinning ? "Girando..." : "🎡 Girar la ruleta"}
        </Btn>
      )}

      {result && (
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7F77DD", margin: "0 0 6px" }}>Salió</p>
          <p style={S.bigReveal}>{result.name}</p>
          {result.description && <p style={{ fontSize: 14, color: "#e8e4f0", margin: "8px 0 0" }}>{result.description}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {mode === "eliminate" ? (
              <Btn variant="danger" onClick={confirmEliminate}>Sacar de la ruleta</Btn>
            ) : (
              <Btn variant="success" onClick={spinAgain}>Girar de nuevo</Btn>
            )}
          </div>
        </div>
      )}

      {finished && (
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#7F77DD", margin: "0 0 6px" }}>Queda</p>
          <p style={S.bigReveal}>{pool[0].name}</p>
          {pool[0].description && <p style={{ fontSize: 14, color: "#e8e4f0", margin: "8px 0 0" }}>{pool[0].description}</p>}
        </div>
      )}

      {mode === "eliminate" && eliminated.length > 0 && (
        <div style={S.card}>
          <span style={S.label}>Orden de eliminación</span>
          {eliminated.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < eliminated.length - 1 ? "1px solid rgba(127,119,221,0.1)" : "none" }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(226,75,74,0.15)", color: "#F09595", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name}</span>
            </div>
          ))}
        </div>
      )}

      {mode === "keep" && Object.keys(counts).length > 0 && (
        <div style={S.card}>
          <button onClick={() => setShowStats(v => !v)} style={{ ...S.btn("default"), justifyContent: "space-between" }}>
            <span>Ver cuántas veces salió cada opción</span>
            <span>{showStats ? "▲" : "▼"}</span>
          </button>
          {showStats && (
            <div style={{ marginTop: 12 }}>
              {[...entries].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)).map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                  <span style={S.pill(!!counts[e.id])}>{counts[e.id] || 0}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Btn variant="default" onClick={() => setPhase("setup")} style={{ marginTop: 10 }}>Volver a cargar entradas</Btn>
    </div>
  );
}
