import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { shuffle } from "../../utils/shuffle";
import { Btn } from "../../components/Btn";
import { Toggle } from "../../components/Toggle";
import { Avatar } from "../../components/Avatar";

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL GAME MODE — un solo dispositivo, se pasa de mano en mano
// ═══════════════════════════════════════════════════════════════════════════════

export function LocalGame() {
  const [phase, setPhase] = useState("setup"); // setup|reveal|clues|vote|result
  const [players, setPlayers] = useState([{ id: 1, name: "Jugador 1" }, { id: 2, name: "Jugador 2" }, { id: 3, name: "Jugador 3" }, { id: 4, name: "Jugador 4" }]);
  const [newName, setNewName] = useState("");
  const [config, setConfig] = useState({ numImpostors: 1, hintsEnabled: true, clueTime: 90, enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}) });
  const [round, setRound] = useState(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(false);
  const [clues, setClues] = useState({});
  const [clueInput, setClueInput] = useState({});
  const [readyPlayers, setReadyPlayers] = useState(new Set());
  const [votes, setVotes] = useState({});
  const [usedWords, setUsedWords] = useState({});
  const [history, setHistory] = useState([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);
  const [tab, setTab] = useState("players"); // players|config

  const activeCats = Object.keys(config.enabledCategories).filter(k => config.enabledCategories[k]);

  const startRound = () => {
    const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
    const cat = CATEGORIES[catKey];
    const used = usedWords[catKey] || [];
    const available = cat.words.filter(w => !used.includes(w));
    if (!available.length) return alert(`Sin palabras disponibles en ${cat.label}`);
    const word = available[Math.floor(Math.random() * available.length)];
    setUsedWords(prev => ({ ...prev, [catKey]: [...(prev[catKey] || []), word] }));
    const ids = shuffle(players.map(p => p.id));
    const impostors = ids.slice(0, Math.min(config.numImpostors, Math.floor(players.length / 2)));
    setRound({ word, categoryKey: catKey, categoryLabel: cat.label, categoryIcon: cat.icon, impostors });
    setRevealIdx(0);
    setWordVisible(false);
    setClues({});
    setClueInput({});
    setReadyPlayers(new Set());
    setVotes({});
    setPhase("reveal");
  };

  const goToClues = () => {
    setPhase("clues");
    if (config.clueTime > 0) {
      setTimeLeft(config.clueTime);
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current); setPhase("vote"); return 0; }
          return t - 1;
        });
      }, 1000);
    }
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const markReady = (pid) => {
    const next = new Set(readyPlayers);
    next.add(pid);
    setReadyPlayers(next);
    if (next.size >= players.length) {
      clearInterval(timerRef.current);
      setPhase("vote");
    }
  };

  const castVote = (voterId, suspectId) => {
    const next = { ...votes, [voterId]: suspectId };
    setVotes(next);
    if (Object.keys(next).length >= players.length) {
      const tally = {};
      players.forEach(p => { tally[p.id] = 0; });
      Object.values(next).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
      const maxV = Math.max(...Object.values(tally));
      const top = Object.entries(tally).filter(([, v]) => v === maxV).map(([id]) => id);
      const eliminated = top[Math.floor(Math.random() * top.length)];
      const wasImpostor = round.impostors.includes(eliminated);
      setRound(r => ({ ...r, eliminated, wasImpostor, tally }));
      setHistory(h => [...h, { ...round, eliminated, wasImpostor, tally }]);
      setPhase("result");
    }
  };

  // ── SETUP ──
  if (phase === "setup") return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["players", "config"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...S.btn(tab === t ? "primary" : "secondary"), flex: 1, padding: "10px" }}>
            {t === "players" ? "👥 Jugadores" : "⚙️ Config"}
          </button>
        ))}
      </div>

      {tab === "players" && <>
        <div style={S.card}>
          <span style={S.label}>Jugadores ({players.length})</span>
          {players.map(p => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <Avatar name={p.name} size={32} />
              <input style={{ ...S.input, flex: 1 }} value={p.name} onChange={e => setPlayers(prev => prev.map(x => x.id === p.id ? { ...x, name: e.target.value } : x))} />
              <button onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))} style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}>×</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input style={{ ...S.input, flex: 1 }} placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { setPlayers(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName(""); } }} />
            <Btn variant="secondary" onClick={() => { if (newName.trim()) { setPlayers(p => [...p, { id: Date.now(), name: newName.trim() }]); setNewName(""); } }} style={{ width: "auto", padding: "11px 18px" }}>+ Agregar</Btn>
          </div>
        </div>
      </>}

      {tab === "config" && <>
        <div style={S.card}>
          <span style={S.label}>Impostores</span>
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map(n => <button key={n} onClick={() => setConfig(c => ({ ...c, numImpostors: n }))} style={{ ...S.btn(config.numImpostors === n ? "primary" : "secondary"), flex: 1, padding: "10px 0", fontSize: 14 }}>{n}</button>)}
          </div>
        </div>
        <div style={S.card}>
          <Toggle label={config.hintsEnabled ? "Pistas al impostor activas" : "Sin pistas"} value={config.hintsEnabled} onChange={v => setConfig(c => ({ ...c, hintsEnabled: v }))} />
        </div>
        <div style={S.card}>
          <span style={S.label}>Tiempo para pistas: {config.clueTime === 0 ? "Sin límite" : `${config.clueTime}s`}</span>
          <input type="range" min="0" max="180" step="15" value={config.clueTime} onChange={e => setConfig(c => ({ ...c, clueTime: +e.target.value }))} style={{ width: "100%" }} />
        </div>
        <div style={S.card}>
          <span style={S.label}>Categorías</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(CATEGORIES).map(([k, cat]) => (
              <Toggle key={k} label={`${cat.icon} ${cat.label}`} value={config.enabledCategories[k]} onChange={v => setConfig(c => ({ ...c, enabledCategories: { ...c.enabledCategories, [k]: v } }))} />
            ))}
          </div>
        </div>
      </>}

      <Btn onClick={startRound} disabled={players.length < 3 || activeCats.length === 0} style={{ marginTop: 8 }}>🚀 Iniciar ronda</Btn>
      {players.length < 3 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo 3 jugadores</p>}

      {history.length > 0 && <div style={{ ...S.card, marginTop: 20 }}>
        <span style={S.label}>Historial</span>
        {history.map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(127,119,221,0.08)", fontSize: 13 }}>
          <span style={{ color: "#b8b0d4" }}>{r.categoryIcon} {r.categoryLabel}</span>
          <span style={{ color: r.wasImpostor ? "#5DCAA5" : "#F09595" }}>{r.wasImpostor ? "✓ Atrapado" : "✗ Escapó"} · "{r.word}"</span>
        </div>)}
      </div>}
    </div>
  );

  // ── REVEAL ──
  if (phase === "reveal") {
    const player = players[revealIdx];
    const isImpostor = round.impostors.includes(player.id);
    const isLast = revealIdx === players.length - 1;
    return (
      <div>
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Jugador {revealIdx + 1} de {players.length}</p>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Avatar name={player.name} size={56} />
          <p style={{ fontWeight: 800, fontSize: 20, marginTop: 10 }}>{player.name}</p>
        </div>
        <div
          style={{ ...S.card, textAlign: "center", cursor: "pointer", border: wordVisible ? "1px solid rgba(127,119,221,0.4)" : "1px solid rgba(255,255,255,0.08)", minHeight: 120, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", userSelect: "none" }}
          onClick={() => setWordVisible(v => !v)}
        >
          {!wordVisible ? (
            <>
              <p style={{ fontSize: 28 }}>👁️</p>
              <p style={{ color: "#6b6490", fontSize: 15 }}>Tocá para revelar tu palabra</p>
            </>
          ) : isImpostor ? (
            <>
              <p style={{ fontSize: 36 }}>🕵️</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#F09595", margin: "8px 0" }}>¡ERES EL IMPOSTOR!</p>
              {config.hintsEnabled && <p style={{ fontSize: 13, color: "#9089c0" }}>Categoría: {round.categoryLabel}</p>}
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 6 }}>Tu palabra</p>
              <p style={S.bigReveal}>{round.word}</p>
              <p style={{ fontSize: 13, color: "#7F77DD" }}>{round.categoryIcon} {round.categoryLabel}</p>
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          )}
        </div>
        <Btn onClick={() => { setWordVisible(false); if (isLast) goToClues(); else setRevealIdx(i => i + 1); }}>
          {isLast ? "✓ Todos listos → Empezar" : `Siguiente jugador →`}
        </Btn>
      </div>
    );
  }

  // ── CLUES ──
  if (phase === "clues") return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center" }}>
        <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Categoría de esta ronda</p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#AFA9EC" }}>{round.categoryIcon} {round.categoryLabel}</p>
      </div>
      {config.clueTime > 0 && <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "#9089c0" }}>Tiempo restante</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>{timeLeft}s</span>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${Math.round((timeLeft / config.clueTime) * 100)}%`, background: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5", transition: "width 1s, background 0.5s" }} />
        </div>
      </div>}
      {players.map(p => (
        <div key={p.id} style={{ ...S.card, borderColor: readyPlayers.has(p.id) ? "rgba(29,158,117,0.4)" : "rgba(127,119,221,0.18)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: readyPlayers.has(p.id) ? 0 : 10 }}>
            <Avatar name={p.name} size={32} />
            <span style={{ fontWeight: 700, flex: 1 }}>{p.name}</span>
            {readyPlayers.has(p.id) && <span style={S.pill(true)}>✓ Listo</span>}
          </div>
          {!readyPlayers.has(p.id) && <>
            <input style={S.input} placeholder="Escribí tu pista..." value={clueInput[p.id] || ""} onChange={e => setClueInput(c => ({ ...c, [p.id]: e.target.value }))} />
            <Btn variant="success" onClick={() => { setClues(c => ({ ...c, [p.id]: clueInput[p.id] || "" })); markReady(p.id); }} style={{ marginTop: 8 }}>✓ Listo</Btn>
          </>}
        </div>
      ))}
      <Btn variant="secondary" onClick={() => { clearInterval(timerRef.current); setPhase("vote"); }}>⏭️ Ir a votación ahora</Btn>
    </div>
  );

  // ── VOTE ──
  if (phase === "vote") return (
    <div>
      <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 20 }}>
        <p style={{ fontSize: 14, color: "#9089c0" }}>Pistas dadas:</p>
        {Object.entries(clues).map(([pid, clue]) => {
          const p = players.find(x => x.id === +pid || x.id === pid);
          return p && clue ? <p key={pid} style={{ fontSize: 14, margin: "4px 0", color: "#b8b0d4" }}><strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {clue}</p> : null;
        })}
      </div>
      {players.map(voter => (
        <div key={voter.id} style={S.card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Avatar name={voter.name} size={28} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{voter.name} sospecha de:</span>
            {votes[voter.id] && <span style={S.pill(true)}>✓ Votó</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {players.filter(p => p.id !== voter.id).map(suspect => (
              <button key={suspect.id} onClick={() => castVote(voter.id, suspect.id)}
                style={{ ...S.btn(votes[voter.id] === suspect.id ? "danger" : "secondary"), width: "auto", padding: "8px 14px", fontSize: 13, borderRadius: 8 }}>
                {suspect.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p style={{ ...S.muted, textAlign: "center" }}>Faltan {players.length - Object.keys(votes).length} votos</p>
    </div>
  );

  // ── RESULT ──
  if (phase === "result") {
    const eliminated = players.find(p => p.id === round.eliminated);
    const impostorPlayers = players.filter(p => round.impostors.includes(p.id));
    return (
      <div>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 60 }}>{round.wasImpostor ? "🎉" : "😈"}</div>
          <p style={{ ...S.title, fontSize: 26, display: "block", marginTop: 8 }}>{round.wasImpostor ? "¡Impostor atrapado!" : "¡El impostor escapó!"}</p>
        </div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9089c0" }}>La palabra era</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>{round.word}</p>
          <p style={{ fontSize: 13, color: "#7F77DD" }}>{round.categoryIcon} {round.categoryLabel}</p>
        </div>
        <div style={S.card}>
          <span style={S.label}>Impostores</span>
          {impostorPlayers.map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}><Avatar name={p.name} size={32} /><span style={{ fontWeight: 700 }}>{p.name}</span><span style={S.pill(false)}>🕵️ Impostor</span></div>)}
        </div>
        {eliminated && <div style={S.card}>
          <span style={S.label}>Eliminado</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar name={eliminated.name} size={36} /><span style={{ fontWeight: 700 }}>{eliminated.name}</span><span style={S.pill(round.wasImpostor)}>{round.wasImpostor ? "✓ Era el impostor" : "✗ Era inocente"}</span></div>
        </div>}
        <div style={S.card}>
          <span style={S.label}>Votos</span>
          {players.map(p => {
            const count = (round.tally || {})[p.id] || 0;
            return <div key={p.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 13 }}>{p.name}</span><span style={S.muted}>{count} votos</span></div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}><div style={{ height: "100%", borderRadius: 3, width: `${players.length > 1 ? Math.round((count / (players.length - 1)) * 100) : 0}%`, background: round.impostors.includes(p.id) ? "#E24B4A" : "#534AB7", transition: "width 0.6s" }} /></div>
            </div>;
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn variant="success" onClick={startRound}>▶️ Nueva ronda</Btn>
          <Btn variant="secondary" onClick={() => setPhase("setup")}>🏠 Configuración</Btn>
        </div>
      </div>
    );
  }

  return null;
}
