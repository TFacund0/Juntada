import { useState, useEffect, useRef } from "react";
import { S } from "../../theme/styles";
import { CATEGORIES } from "@juntada/impostor-data";
import { shuffle } from "../../utils/shuffle";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL GAME MODE — un solo dispositivo, se pasa de mano en mano.
// Las pistas se dicen en voz alta por defecto; "Pistas escritas" en la config
// hace que cada uno la tipee al final de su turno de revelación, para poder
// repasarlas juntos antes de votar.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: number;
  name: string;
}

// The most impostors a room of this size can start with while keeping them
// a strict minority — mirrors backend/src/games/impostor/engine.ts.
function maxImpostors(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

interface Round {
  word: string;
  categoryKey: string;
  categoryLabel: string;
  impostors: number[];
  eliminated?: number;
  wasImpostor?: boolean;
  tally?: Record<number, number>;
}

interface Config {
  numImpostors: number;
  hintsEnabled: boolean;
  writtenClues: boolean;
  discussionTime: number;
  enabledCategories: Record<string, boolean>;
}

function CluesReview({ clues, players }: { clues: Record<number, string>; players: LocalPlayer[] }) {
  const entries = Object.entries(clues || {}).filter(([, clue]) => clue);
  if (entries.length === 0) return null;
  return (
    <div style={S.card}>
      <span style={S.label}>Pistas</span>
      {entries.map(([playerId, clue]) => {
        const p = players.find(x => String(x.id) === playerId);
        if (!p) return null;
        return (
          <p key={playerId} style={{ fontSize: 14, margin: "4px 0", color: "#b8b0d4" }}>
            <strong style={{ color: "#AFA9EC" }}>{p.name}:</strong> {clue}
          </p>
        );
      })}
    </div>
  );
}

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "reveal" | "discussion" | "vote" | "result">("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
    { id: 4, name: "Jugador 4" },
  ]);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState("");
  const [config, setConfig] = useState<Config>({
    numImpostors: 1,
    hintsEnabled: true,
    writtenClues: false,
    discussionTime: 30,
    // Off by default — you have to actively pick which categories are in
    // play rather than opt out of a preselected set.
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {} as Record<string, boolean>),
  });
  const [round, setRound] = useState<Round | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [wordVisible, setWordVisible] = useState(false);
  const [clueInput, setClueInput] = useState("");
  const [clues, setClues] = useState<Record<number, string>>({});
  const [selection, setSelection] = useState<Record<number, number>>({}); // voterId -> suspectId not yet confirmed
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [usedWords, setUsedWords] = useState<Record<string, string[]>>({});
  const [history, setHistory] = useState<Round[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tab, setTab] = useState<"players" | "config">("players");

  const activeCats = Object.keys(config.enabledCategories).filter(k => config.enabledCategories[k]);

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
  };

  const renamePlayer = (id: number, name: string) => {
    if (name.trim() && isDuplicateName(name, id)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(prev => prev.map(x => (x.id === id ? { ...x, name } : x)));
  };

  const addPlayer = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (isDuplicateName(trimmed, null)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(p => [...p, { id: Date.now(), name: trimmed }]);
    setNewName("");
  };

  const startRound = () => {
    const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
    const cat = (CATEGORIES as any)[catKey];
    const used = usedWords[catKey] || [];
    const available = cat.words.filter((w: string) => !used.includes(w));
    if (!available.length) return alert(`Sin palabras disponibles en ${cat.label}`);
    const word = available[Math.floor(Math.random() * available.length)];
    setUsedWords(prev => ({ ...prev, [catKey]: [...(prev[catKey] || []), word] }));
    const ids = shuffle(players.map(p => p.id));
    const impostors = ids.slice(0, Math.min(config.numImpostors, maxImpostors(players.length)));
    setRound({ word, categoryKey: catKey, categoryLabel: cat.label, impostors });
    setRevealIdx(0);
    setWordVisible(false);
    setClueInput("");
    setClues({});
    setSelection({});
    setVotes({});
    setPhase("reveal");
  };

  const goToDiscussion = () => {
    if (config.discussionTime <= 0) {
      setPhase("vote");
      return;
    }
    setPhase("discussion");
    setTimeLeft(config.discussionTime);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase("vote");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  const confirmVote = (voterId: number) => {
    const suspectId = selection[voterId];
    if (!suspectId) return;
    const next = { ...votes, [voterId]: suspectId };
    setVotes(next);
    if (Object.keys(next).length >= players.length) {
      const tally: Record<number, number> = {};
      players.forEach(p => {
        tally[p.id] = 0;
      });
      Object.values(next).forEach(id => {
        tally[id] = (tally[id] || 0) + 1;
      });
      const maxV = Math.max(...Object.values(tally));
      const top = Object.entries(tally)
        .filter(([, v]) => v === maxV)
        .map(([id]) => Number(id));
      const eliminated = top[Math.floor(Math.random() * top.length)];
      const wasImpostor = round!.impostors.includes(eliminated);
      const resolved: Round = { ...round!, eliminated, wasImpostor, tally };
      setRound(resolved);
      setHistory(h => [...h, resolved]);
      setPhase("result");
    }
  };

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["players", "config"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ ...S.btn(tab === t ? "primary" : "ghost"), flex: 1, padding: "10px" }}>
              {t === "players" ? "Jugadores" : "Configuración"}
            </button>
          ))}
        </div>

        {tab === "players" && (
          <>
            <div style={S.card}>
              <span style={S.label}>Jugadores ({players.length})</span>
              {players.map(p => (
                <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <Avatar name={p.name} size={32} />
                  <input style={{ ...S.input, flex: 1 }} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
                  <button
                    onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))}
                    style={{ ...S.btn("danger"), width: 36, height: 36, padding: 0, borderRadius: 8, flexShrink: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input
                  style={{ ...S.input, flex: 1 }}
                  placeholder="Nombre"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") addPlayer();
                  }}
                />
                <Btn variant="ghost" onClick={addPlayer} style={{ width: "auto", padding: "11px 18px" }}>
                  Agregar
                </Btn>
              </div>
              {nameError && <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>{nameError}</p>}
            </div>
          </>
        )}

        {tab === "config" && (
          <>
            <div style={S.card}>
              <span style={S.label}>Impostores</span>
              <div style={{ display: "flex", gap: 8 }}>
                {[1, 2, 3].map(n => {
                  const maxImp = maxImpostors(players.length);
                  return (
                    <button
                      key={n}
                      onClick={() => setConfig(c => ({ ...c, numImpostors: n }))}
                      disabled={n > maxImp}
                      style={{
                        ...S.btn(config.numImpostors === n ? "primary" : "ghost"),
                        flex: 1,
                        padding: "10px 0",
                        fontSize: 14,
                        opacity: n > maxImp ? 0.35 : 1,
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {maxImpostors(players.length) < 3 && (
                <p style={{ ...S.muted, marginTop: 8, lineHeight: 1.4 }}>
                  Con {players.length} jugadores, como máximo puede haber {maxImpostors(players.length)}{" "}
                  {maxImpostors(players.length) === 1 ? "impostor" : "impostores"}.
                </p>
              )}
            </div>
            <div style={S.card}>
              <span style={S.label}>¿El impostor recibe una pista?</span>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setConfig(c => ({ ...c, hintsEnabled: true }))}
                  style={{ ...S.btn(config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  Sí, con pista
                </button>
                <button
                  onClick={() => setConfig(c => ({ ...c, hintsEnabled: false }))}
                  style={{ ...S.btn(!config.hintsEnabled ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  No, a ciegas
                </button>
              </div>
              <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                {config.hintsEnabled
                  ? "El impostor ve la categoría, para poder disimular."
                  : "El impostor no sabe nada de la palabra secreta — tiene que improvisar."}
              </p>
            </div>
            <div style={S.card}>
              <span style={S.label}>¿Cómo dan su palabra los jugadores?</span>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setConfig(c => ({ ...c, writtenClues: true }))}
                  style={{ ...S.btn(config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  Escrita
                </button>
                <button
                  onClick={() => setConfig(c => ({ ...c, writtenClues: false }))}
                  style={{ ...S.btn(!config.writtenClues ? "primary" : "ghost"), flex: 1, padding: "10px 8px", fontSize: 13 }}
                >
                  En voz alta
                </button>
              </div>
              <p style={{ ...S.muted, marginTop: 10, lineHeight: 1.4 }}>
                {config.writtenClues
                  ? "Cada uno escribe su palabra en el dispositivo antes de pasarlo, y quedan visibles para repasar antes de votar."
                  : "Cada uno dice su palabra en voz alta, por turnos, sin escribir nada."}
              </p>
            </div>
            <div style={S.card}>
              <span style={S.label}>
                Tiempo de discusión: {config.discussionTime === 0 ? "Sin fase de discusión" : `${config.discussionTime}s`}
              </span>
              <input
                type="range"
                min="0"
                max="180"
                step="15"
                value={config.discussionTime}
                onChange={e => setConfig(c => ({ ...c, discussionTime: +e.target.value }))}
                style={{ width: "100%", marginTop: 8 }}
              />
            </div>
            <div style={S.card}>
              <span style={S.label}>Categorías</span>
              <p style={{ ...S.muted, margin: "0 0 14px", lineHeight: 1.4 }}>Elegí de qué van a ser las palabras. Tocá una categoría para activarla.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {Object.entries(CATEGORIES).map(([k, cat]: [string, any]) => {
                  const active = !!config.enabledCategories[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setConfig(c => ({ ...c, enabledCategories: { ...c.enabledCategories, [k]: !active } }))}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 16px",
                        borderRadius: 999,
                        border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
                        background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
                        color: active ? "#fff" : "#9089c0",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: active ? "0 3px 14px rgba(127,119,221,0.35)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
              <p style={{ ...S.muted, marginTop: 12 }}>
                {activeCats.length === 0
                  ? "No elegiste ninguna categoría todavía."
                  : `${activeCats.length} categoría${activeCats.length === 1 ? "" : "s"} activa${activeCats.length === 1 ? "" : "s"}.`}
              </p>
            </div>
          </>
        )}

        <Btn onClick={startRound} disabled={players.length < 3 || activeCats.length === 0} style={{ marginTop: 8 }}>
          Iniciar ronda
        </Btn>
        {players.length < 3 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo 3 jugadores</p>}

        {history.length > 0 && (
          <div style={{ ...S.card, marginTop: 20 }}>
            <span style={S.label}>Historial</span>
            {history.map((r, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(127,119,221,0.08)",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#b8b0d4" }}>{r.categoryLabel}</span>
                <span style={{ color: r.wasImpostor ? "#5DCAA5" : "#F09595" }}>
                  {r.wasImpostor ? "Atrapado" : "Escapó"} · "{r.word}"
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );

  // ── REVEAL ──
  if (phase === "reveal" && round) {
    const player = players[revealIdx];
    const isImpostor = round.impostors.includes(player.id);
    const isLast = revealIdx === players.length - 1;
    const needsClue = config.writtenClues && !clueInput.trim();

    const advance = () => {
      if (config.writtenClues) setClues(c => ({ ...c, [player.id]: clueInput.trim() }));
      setWordVisible(false);
      setClueInput("");
      if (isLast) goToDiscussion();
      else setRevealIdx(i => i + 1);
    };

    return (
      <div>
        <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>
          Jugador {revealIdx + 1} de {players.length}
        </p>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <Avatar name={player.name} size={56} />
          <p style={{ fontWeight: 800, fontSize: 20, marginTop: 10 }}>{player.name}</p>
        </div>
        <div
          style={{
            ...S.card,
            textAlign: "center",
            cursor: "pointer",
            border: wordVisible ? "1px solid rgba(127,119,221,0.4)" : "1px solid rgba(255,255,255,0.08)",
            minHeight: 120,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none",
          }}
          onClick={() => setWordVisible(v => !v)}
        >
          {!wordVisible ? (
            <p style={{ color: "#6b6490", fontSize: 15 }}>Tocá para revelar tu palabra</p>
          ) : isImpostor ? (
            <>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#F09595", margin: "0 0 8px" }}>Sos el impostor</p>
              {config.hintsEnabled && <p style={{ fontSize: 13, color: "#9089c0" }}>Categoría: {round.categoryLabel}</p>}
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "#9089c0", marginBottom: 6 }}>Tu palabra</p>
              <p style={S.bigReveal}>{round.word}</p>
              <p style={{ fontSize: 13, color: "#7F77DD" }}>{round.categoryLabel}</p>
              <p style={{ fontSize: 12, color: "#5a5280", marginTop: 8 }}>Tocá para ocultar</p>
            </>
          )}
        </div>
        {config.writtenClues && wordVisible && (
          <div style={S.card}>
            <span style={S.label}>Tu pista</span>
            <input
              style={S.input}
              placeholder="Escribí tu pista antes de pasar el dispositivo..."
              value={clueInput}
              onChange={e => setClueInput(e.target.value)}
            />
          </div>
        )}
        <Btn onClick={advance} disabled={!wordVisible || needsClue}>
          {isLast ? "Todos listos, empezar" : "Siguiente jugador"}
        </Btn>
      </div>
    );
  }

  // ── DISCUSSION ──
  if (phase === "discussion" && round)
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9089c0", marginBottom: 4 }}>Categoría de esta ronda</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: "#AFA9EC" }}>{round.categoryLabel}</p>
        </div>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#9089c0" }}>Tiempo restante</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5" }}>
              {timeLeft}s
            </span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
            <div
              style={{
                height: "100%",
                borderRadius: 3,
                width: `${Math.round((timeLeft / config.discussionTime) * 100)}%`,
                background: timeLeft < 15 ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5",
                transition: "width 1s, background 0.5s",
              }}
            />
          </div>
        </div>
        {config.writtenClues ? (
          <CluesReview clues={clues} players={players} />
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Repasen entre todos lo que dijo cada uno antes de votar.</p>
        )}
        <Btn
          variant="ghost"
          onClick={() => {
            if (timerRef.current) clearInterval(timerRef.current);
            setPhase("vote");
          }}
        >
          Ir a votación
        </Btn>
      </div>
    );

  // ── VOTE ──
  if (phase === "vote")
    return (
      <div>
        <CluesReview clues={clues} players={players} />
        {players.map(voter => {
          const confirmed = votes[voter.id] != null;
          const pending = selection[voter.id];
          return (
            <div key={voter.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: confirmed ? 0 : 12 }}>
                <Avatar name={voter.name} size={28} />
                <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{voter.name} sospecha de:</span>
                {confirmed && <span style={S.pill(true)}>Confirmado</span>}
              </div>
              {!confirmed && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {players
                      .filter(p => p.id !== voter.id)
                      .map(suspect => (
                        <button
                          key={suspect.id}
                          onClick={() => setSelection(s => ({ ...s, [voter.id]: suspect.id }))}
                          style={{
                            ...S.btn(pending === suspect.id ? "danger" : "ghost"),
                            width: "auto",
                            padding: "8px 14px",
                            fontSize: 13,
                            borderRadius: 8,
                          }}
                        >
                          {suspect.name}
                        </button>
                      ))}
                  </div>
                  <Btn variant="success" disabled={!pending} onClick={() => confirmVote(voter.id)} style={{ marginTop: 10 }}>
                    Confirmar voto
                  </Btn>
                </>
              )}
            </div>
          );
        })}
        <p style={{ ...S.muted, textAlign: "center" }}>Faltan {players.length - Object.keys(votes).length} confirmaciones</p>
      </div>
    );

  // ── RESULT ──
  if (phase === "result" && round) {
    const eliminated = players.find(p => p.id === round.eliminated);
    const impostorPlayers = players.filter(p => round.impostors.includes(p.id));
    return (
      <div>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <p style={{ ...S.title, fontSize: 26, display: "block" }}>{round.wasImpostor ? "Impostor atrapado" : "El impostor escapó"}</p>
        </div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 12, color: "#9089c0" }}>La palabra era</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: "4px 0" }}>{round.word}</p>
          <p style={{ fontSize: 13, color: "#7F77DD" }}>{round.categoryLabel}</p>
        </div>
        <div style={S.card}>
          <span style={S.label}>Impostores</span>
          {impostorPlayers.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Avatar name={p.name} size={32} />
              <span style={{ fontWeight: 700 }}>{p.name}</span>
            </div>
          ))}
        </div>
        {eliminated && (
          <div style={S.card}>
            <span style={S.label}>Eliminado</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={eliminated.name} size={36} />
              <span style={{ fontWeight: 700 }}>{eliminated.name}</span>
              <span style={S.pill(!!round.wasImpostor)}>{round.wasImpostor ? "Era el impostor" : "Era inocente"}</span>
            </div>
          </div>
        )}
        <div style={S.card}>
          <span style={S.label}>Votos</span>
          {players.map(p => {
            const count = (round.tally || {})[p.id] || 0;
            return (
              <div key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span style={S.muted}>{count} votos</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 3,
                      width: `${players.length > 1 ? Math.round((count / (players.length - 1)) * 100) : 0}%`,
                      background: round.impostors.includes(p.id) ? "#E24B4A" : "#534AB7",
                      transition: "width 0.6s",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Btn variant="success" onClick={startRound}>
            Nueva ronda
          </Btn>
          <Btn variant="ghost" onClick={() => setPhase("setup")}>
            Configuración
          </Btn>
        </div>
      </div>
    );
  }

  return null;
}
