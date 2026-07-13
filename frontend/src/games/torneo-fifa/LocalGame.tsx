import { useState } from "react";
import { S } from "../../theme/styles";
import { shuffle } from "../../utils/shuffle";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { buildBracket, nextPowerOf2, propagateByes } from "@juntada/torneo-fifa-bracket";
import type { Entrant, Match } from "@juntada/torneo-fifa-bracket";

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEO FIFA — un solo dispositivo. Carga de jugadores + equipos, sorteo de
// equipos (aleatorio o manual), bracket de eliminación directa (con byes si el
// número de jugadores no es potencia de 2), carga de resultados con goleador
// opcional, y pantalla final con campeón + estadísticas.
// ═══════════════════════════════════════════════════════════════════════════════

interface LocalPlayer {
  id: number;
  name: string;
}

const DEFAULT_TEAMS = [
  "Argentina",
  "Brasil",
  "Francia",
  "España",
  "Alemania",
  "Inglaterra",
  "Italia",
  "Portugal",
  "Países Bajos",
  "Bélgica",
  "Uruguay",
  "Croacia",
  "Real Madrid",
  "Barcelona",
  "Manchester City",
  "Boca Juniors",
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const ROUND_NAMES = (totalRounds: number): string[] => {
  const names = ["Final", "Semifinal", "Cuartos de final", "Octavos de final", "Dieciseisavos de final"];
  return Array.from({ length: totalRounds }, (_, i) => names[totalRounds - 1 - i] || `Ronda ${i + 1}`);
};

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "assign" | "seed" | "bracket" | "champion">("setup");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
    { id: 4, name: "Jugador 4" },
  ]);
  const [newName, setNewName] = useState("");
  const [teams, setTeams] = useState(DEFAULT_TEAMS.slice(0, 8));
  const [newTeam, setNewTeam] = useState("");
  const [trackGoals, setTrackGoals] = useState(true);
  const [assignments, setAssignments] = useState<Record<number, string>>({}); // playerId -> team
  const [manualPick, setManualPick] = useState<number | null>(null); // playerId being assigned manually
  const [nameError, setNameError] = useState("");
  const [spinningId, setSpinningId] = useState<number | null>(null); // playerId currently on the roulette
  const [spinLabel, setSpinLabel] = useState("");
  const [seedOrder, setSeedOrder] = useState<number[]>([]); // array de playerId, orden de cruce
  const [rounds, setRounds] = useState<Match<number>[][] | null>(null);
  const [scoreInput, setScoreInput] = useState({ goalsA: "", goalsB: "" });
  const [editingMatch, setEditingMatch] = useState<{ roundIdx: number; matchIdx: number } | null>(null);

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
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

  const renamePlayer = (id: number, name: string) => {
    if (name.trim() && isDuplicateName(name, id)) {
      setNameError("Ya hay un jugador con ese nombre");
      return;
    }
    setNameError("");
    setPlayers(prev => prev.map(x => (x.id === id ? { ...x, name } : x)));
  };

  const addTeam = () => {
    const trimmed = newTeam.trim();
    if (!trimmed || teams.includes(trimmed)) return;
    setTeams(t => [...t, trimmed]);
    setNewTeam("");
  };

  const goToAssign = () => {
    setAssignments({});
    setPhase("assign");
  };

  const spinRoulette = async (playerId: number, pool: string[], finalTeam: string) => {
    setSpinningId(playerId);
    let delay = 70;
    for (let i = 0; i < 18; i++) {
      setSpinLabel(pool[Math.floor(Math.random() * pool.length)]);
      await sleep(delay);
      delay += 12; // desacelera
    }
    setSpinLabel(finalTeam);
    await sleep(550);
    setSpinningId(null);
  };

  const runRouletteAll = async () => {
    if (spinningId) return;
    const finalTeams = shuffle(teams).slice(0, players.length);
    setAssignments({});
    for (let i = 0; i < players.length; i++) {
      await spinRoulette(players[i].id, teams, finalTeams[i]);
      setAssignments(prev => ({ ...prev, [players[i].id]: finalTeams[i] }));
    }
  };

  const spinRouletteForPlayer = async (playerId: number) => {
    if (spinningId) return;
    const pool = teams.filter(t => !usedTeams.has(t));
    if (!pool.length) return;
    const finalTeam = pool[Math.floor(Math.random() * pool.length)];
    await spinRoulette(playerId, pool, finalTeam);
    setAssignments(prev => ({ ...prev, [playerId]: finalTeam }));
  };

  const assignTeamManually = (playerId: number, team: string) => {
    setAssignments(prev => ({ ...prev, [playerId]: team }));
    setManualPick(null);
  };

  const clearAssignment = (playerId: number) => {
    setAssignments(prev => {
      const n = { ...prev };
      delete n[playerId];
      return n;
    });
  };

  const usedTeams = new Set(Object.values(assignments));
  const allAssigned = players.every(p => assignments[p.id]);

  const goToSeed = () => {
    setSeedOrder(players.map(p => p.id));
    setPhase("seed");
  };

  const randomizeSeed = () => setSeedOrder(prev => shuffle(prev));

  const moveSeed = (idx: number, dir: number) => {
    setSeedOrder(prev => {
      const next = [...prev];
      const swapWith = idx + dir;
      if (swapWith < 0 || swapWith >= next.length) return prev;
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  };

  const startBracket = () => {
    const entrants: Entrant<number>[] = seedOrder.map(id => {
      const p = players.find(x => x.id === id)!;
      return { id: p.id, name: p.name, team: assignments[p.id] };
    });
    setRounds(buildBracket(entrants));
    setPhase("bracket");
  };

  const openMatch = (roundIdx: number, matchIdx: number) => {
    setEditingMatch({ roundIdx, matchIdx });
    setScoreInput({ goalsA: "", goalsB: "" });
  };

  const confirmWinnerSimple = (roundIdx: number, matchIdx: number, winner: Entrant<number> | null) => {
    setRounds(prev => {
      const next = prev!.map(r => r.map(m => ({ ...m })));
      next[roundIdx][matchIdx].winner = winner;
      propagateByes(next);
      return next;
    });
    setEditingMatch(null);
  };

  const confirmScore = (roundIdx: number, matchIdx: number) => {
    const ga = parseInt(scoreInput.goalsA, 10);
    const gb = parseInt(scoreInput.goalsB, 10);
    if (Number.isNaN(ga) || Number.isNaN(gb) || ga === gb) return;
    setRounds(prev => {
      const next = prev!.map(r => r.map(m => ({ ...m })));
      const match = next[roundIdx][matchIdx];
      match.goalsA = ga;
      match.goalsB = gb;
      match.winner = ga > gb ? match.a : match.b;
      propagateByes(next);
      return next;
    });
    setEditingMatch(null);
  };

  const isFinished = rounds && rounds[rounds.length - 1][0].winner;
  const champion = isFinished ? rounds![rounds!.length - 1][0].winner : null;

  const stats = () => {
    if (!rounds) return [];
    const tally: Record<number, { player: LocalPlayer; goalsFor: number; goalsAgainst: number; played: number; won: number }> = {};
    players.forEach(p => {
      tally[p.id] = { player: p, goalsFor: 0, goalsAgainst: 0, played: 0, won: 0 };
    });
    rounds.forEach(round =>
      round.forEach(m => {
        if (m.goalsA == null || m.goalsB == null || !m.a || !m.b) return;
        tally[m.a.id].goalsFor += m.goalsA;
        tally[m.a.id].goalsAgainst += m.goalsB;
        tally[m.a.id].played++;
        tally[m.b.id].goalsFor += m.goalsB;
        tally[m.b.id].goalsAgainst += m.goalsA;
        tally[m.b.id].played++;
        if (m.winner) tally[m.winner.id].won++;
      }),
    );
    return Object.values(tally);
  };

  // ── SETUP ──
  if (phase === "setup")
    return (
      <div>
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

        <div style={S.card}>
          <span style={S.label}>Equipos disponibles ({teams.length})</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {teams.map(t => (
              <span
                key={t}
                style={{ ...S.pill(true), cursor: "pointer", maxWidth: "100%" }}
                onClick={() => setTeams(ts => ts.filter(x => x !== t))}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {t}</span>{" "}
                <span style={{ marginLeft: 4, opacity: 0.6, flexShrink: 0 }}>×</span>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...S.input, flex: 1 }}
              placeholder="Agregar equipo..."
              value={newTeam}
              onChange={e => setNewTeam(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") addTeam();
              }}
            />
            <Btn variant="ghost" onClick={addTeam} style={{ width: "auto", padding: "11px 18px" }}>
              Agregar
            </Btn>
          </div>
          {teams.length < players.length && (
            <p style={{ fontSize: 12, color: "#F09595", marginTop: 8 }}>Necesitás al menos {players.length} equipos (uno por jugador)</p>
          )}
        </div>

        <div style={S.card}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setTrackGoals(v => !v)}>
            <div style={S.toggle(trackGoals)}>
              <div style={S.knob(trackGoals)} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: trackGoals ? "#5DCAA5" : "#6b6490" }}>
              {trackGoals ? "Contabilizar goles (goleador, valla menos vencida)" : "Solo ganador/perdedor, sin goles"}
            </span>
          </label>
        </div>

        <Btn onClick={goToAssign} disabled={players.length < 2 || teams.length < players.length}>
          Continuar a sorteo de equipos
        </Btn>
        {players.length < 2 && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo 2 jugadores</p>}
      </div>
    );

  // ── ASSIGN TEAMS ──
  if (phase === "assign")
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9089c0", margin: "0 0 10px" }}>
            Asigná un equipo a cada jugador: con la ruleta (aleatorio, uno por uno) o elegilo vos manualmente.
          </p>
          <Btn variant="success" onClick={runRouletteAll} disabled={!!spinningId}>
            🎰 Girar la ruleta para todos
          </Btn>
        </div>

        <div style={S.card}>
          <span style={S.label}>
            Equipos restantes ({teams.length - usedTeams.size} de {teams.length})
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {teams.map(t => {
              const taken = usedTeams.has(t);
              const landed = !!spinningId && spinLabel === t;
              return (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    maxWidth: "100%",
                    transition: "background 0.08s, border-color 0.08s, color 0.08s",
                    background: landed ? "rgba(239,159,39,0.18)" : taken ? "rgba(255,255,255,0.03)" : "rgba(93,202,165,0.1)",
                    color: landed ? "#EF9F27" : taken ? "#4a4568" : "#5DCAA5",
                    border: `1px solid ${landed ? "rgba(239,159,39,0.5)" : taken ? "rgba(255,255,255,0.06)" : "rgba(93,202,165,0.3)"}`,
                    textDecoration: taken && !landed ? "line-through" : "none",
                  }}
                >
                  🏳️ <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t}</span>
                </span>
              );
            })}
          </div>
        </div>

        {players.map(p => {
          const team = assignments[p.id];
          const isSpinning = spinningId === p.id;
          return (
            <div key={p.id} style={S.card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: team && !isSpinning ? 0 : 12 }}>
                <Avatar name={p.name} size={32} />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.name}
                </span>
                {isSpinning ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#EF9F27" }}>Girando...</span>
                ) : team ? (
                  <span
                    style={{ ...S.pill(true), cursor: "pointer", maxWidth: "55%", flexShrink: 0 }}
                    onClick={() => clearAssignment(p.id)}
                  >
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏳️ {team}</span>{" "}
                    <span style={{ marginLeft: 4, opacity: 0.6, flexShrink: 0 }}>×</span>
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => spinRouletteForPlayer(p.id)}
                      disabled={!!spinningId}
                      style={{ ...S.btn("success", !!spinningId), width: "auto", padding: "8px 12px", fontSize: 13 }}
                    >
                      🎰
                    </button>
                    <Btn
                      variant="ghost"
                      onClick={() => setManualPick(manualPick === p.id ? null : p.id)}
                      disabled={!!spinningId}
                      style={{ width: "auto", padding: "8px 14px", fontSize: 13 }}
                    >
                      Elegir equipo
                    </Btn>
                  </div>
                )}
              </div>

              {isSpinning && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "10px 8px",
                    borderRadius: 10,
                    background: "rgba(239,159,39,0.1)",
                    border: "1px solid rgba(239,159,39,0.35)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#EF9F27" }}>🏳️ {spinLabel}</span>
                </div>
              )}

              {!team && !isSpinning && manualPick === p.id && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {teams
                    .filter(t => !usedTeams.has(t))
                    .map(t => (
                      <button
                        key={t}
                        onClick={() => assignTeamManually(p.id, t)}
                        style={{ ...S.btn("ghost"), width: "auto", padding: "8px 14px", fontSize: 13, borderRadius: 8 }}
                      >
                        {t}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}

        <Btn onClick={goToSeed} disabled={!allAssigned || !!spinningId} variant="success" style={{ marginTop: 8 }}>
          Continuar a armar los cruces
        </Btn>
        <Btn variant="ghost" onClick={() => setPhase("setup")} style={{ marginTop: 10 }}>
          Volver
        </Btn>
      </div>
    );

  // ── SEED (armar cruces) ──
  if (phase === "seed") {
    const size = nextPowerOf2(seedOrder.length);
    const byeCount = size - seedOrder.length;
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9089c0", margin: "0 0 10px" }}>
            Este es el orden de cruce de la primera ronda: cada par de la lista se enfrenta entre sí. Usá las flechas para armarlo a mano, o
            sorteá el orden al azar.
          </p>
          <Btn variant="success" onClick={randomizeSeed}>
            🎲 Sortear cruces al azar
          </Btn>
        </div>

        {byeCount > 0 && (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 14 }}>
            {seedOrder.length} jugadores no completan un cuadro parejo:{" "}
            {byeCount === 1 ? "el último de la lista" : `los últimos ${byeCount} de la lista`} pasa{byeCount === 1 ? "" : "n"} directo a la
            siguiente ronda (bye).
          </p>
        )}

        {Array.from({ length: Math.ceil(seedOrder.length / 2) }, (_, pairIdx) => {
          const idxA = pairIdx * 2;
          const idxB = idxA + 1;
          const idA = seedOrder[idxA];
          const idB = idxB < seedOrder.length ? seedOrder[idxB] : null;
          const pA = players.find(x => x.id === idA)!;
          const pB = idB != null ? players.find(x => x.id === idB) : null;
          const isBye = !pB;

          const row = (p: LocalPlayer, idx: number) => (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
              <Avatar name={p.name} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </p>
                <p
                  style={{ margin: 0, fontSize: 11, color: "#7F77DD", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {assignments[p.id]}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                <button
                  onClick={() => idx > 0 && moveSeed(idx, -1)}
                  style={{ ...S.btn("ghost", idx === 0), width: 26, height: 20, padding: 0, borderRadius: 6, fontSize: 11, lineHeight: 1 }}
                >
                  ▲
                </button>
                <button
                  onClick={() => idx < seedOrder.length - 1 && moveSeed(idx, 1)}
                  style={{
                    ...S.btn("ghost", idx === seedOrder.length - 1),
                    width: 26,
                    height: 20,
                    padding: 0,
                    borderRadius: 6,
                    fontSize: 11,
                    lineHeight: 1,
                  }}
                >
                  ▼
                </button>
              </div>
            </div>
          );

          return (
            <div
              key={pairIdx}
              style={{
                border: `1px solid ${isBye ? "rgba(255,255,255,0.08)" : "rgba(127,119,221,0.35)"}`,
                background: isBye ? "rgba(255,255,255,0.02)" : "rgba(127,119,221,0.06)",
                borderRadius: 14,
                padding: "12px 14px",
                marginBottom: 12,
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: isBye ? "#6b6490" : "#7F77DD",
                }}
              >
                {isBye ? "Pasa directo (bye)" : `Cruce ${pairIdx + 1}`}
              </p>
              {row(pA, idxA)}
              {!isBye && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "6px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "rgba(127,119,221,0.18)" }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#6b6490" }}>VS</span>
                    <div style={{ flex: 1, height: 1, background: "rgba(127,119,221,0.18)" }} />
                  </div>
                  {row(pB!, idxB)}
                </>
              )}
            </div>
          );
        })}

        <Btn onClick={startBracket} variant="success">
          Confirmar cruces y empezar torneo
        </Btn>
        <Btn variant="ghost" onClick={() => setPhase("assign")} style={{ marginTop: 10 }}>
          Volver
        </Btn>
      </div>
    );
  }

  // ── BRACKET ──
  if (phase === "bracket" || phase === "champion") {
    if (isFinished && phase !== "champion") setPhase("champion");
    const roundNames = ROUND_NAMES(rounds!.length);

    if (phase === "champion" && champion) {
      const s = stats().sort((a, b) => b.goalsFor - a.goalsFor);
      const topScorer = trackGoals && s.length ? s[0] : null;
      const leakiest = trackGoals && s.length ? [...s].sort((a, b) => b.goalsAgainst - a.goalsAgainst)[0] : null;
      return (
        <div>
          <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
            <div style={{ fontSize: 56 }}>🏆</div>
            <p style={S.title}>{champion.name}</p>
            <p style={{ color: "#7F77DD", fontSize: 15, fontWeight: 700, marginTop: 4 }}>Campeón del torneo con {champion.team}</p>
          </div>

          {trackGoals && (
            <div style={S.card}>
              <span style={S.label}>Estadísticas del torneo</span>
              {topScorer && topScorer.goalsFor > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>⚽</span>
                  <span style={{ fontSize: 13 }}>
                    Máximo goleador: <strong style={{ color: "#5DCAA5" }}>{topScorer.player.name}</strong> ({topScorer.goalsFor} goles)
                  </span>
                </div>
              )}
              {leakiest && leakiest.goalsAgainst > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🥅</span>
                  <span style={{ fontSize: 13 }}>
                    Valla más goleada: <strong style={{ color: "#F09595" }}>{leakiest.player.name}</strong> ({leakiest.goalsAgainst}{" "}
                    recibidos)
                  </span>
                </div>
              )}
            </div>
          )}

          {trackGoals && (
            <div style={S.card}>
              <span style={S.label}>Tabla de jugadores</span>
              <div
                style={{
                  display: "flex",
                  fontSize: 11,
                  color: "#6b6490",
                  padding: "0 0 8px",
                  borderBottom: "1px solid rgba(127,119,221,0.15)",
                }}
              >
                <span style={{ flex: 1 }}>Jugador</span>
                <span style={{ width: 36, textAlign: "center" }}>PJ</span>
                <span style={{ width: 36, textAlign: "center" }}>GF</span>
                <span style={{ width: 36, textAlign: "center" }}>GC</span>
                <span style={{ width: 40, textAlign: "center" }}>DG</span>
              </div>
              {s.map(row => (
                <div
                  key={row.player.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(127,119,221,0.08)",
                    fontSize: 13,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <Avatar name={row.player.name} size={24} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.player.name}
                    </span>
                    {row.player.id === champion.id && (
                      <span title="Campeón" style={{ flexShrink: 0 }}>
                        🏆
                      </span>
                    )}
                  </span>
                  <span style={{ width: 32, flexShrink: 0, textAlign: "center", color: "#9089c0" }}>{row.played}</span>
                  <span style={{ width: 32, flexShrink: 0, textAlign: "center", color: "#5DCAA5" }}>{row.goalsFor}</span>
                  <span style={{ width: 32, flexShrink: 0, textAlign: "center", color: "#F09595" }}>{row.goalsAgainst}</span>
                  <span style={{ width: 40, flexShrink: 0, textAlign: "center", fontWeight: 700 }}>
                    {row.goalsFor - row.goalsAgainst >= 0 ? "+" : ""}
                    {row.goalsFor - row.goalsAgainst}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={S.card}>
            <span style={S.label}>Camino del torneo</span>
            {rounds!.map((round, ri) => (
              <div key={ri} style={{ marginBottom: 10 }}>
                <p
                  style={{
                    fontSize: 11,
                    color: "#7F77DD",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    margin: "0 0 6px",
                  }}
                >
                  {roundNames[ri]}
                </p>
                {round.map((m, mi) => (
                  <div key={mi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "right",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: m.winner?.id === m.a?.id ? "#5DCAA5" : "#9089c0",
                      }}
                    >
                      {m.a ? m.a.name : "—"}
                    </span>
                    <span style={{ flexShrink: 0, color: "#6b6490", fontSize: 12 }}>
                      {m.goalsA != null ? `${m.goalsA} - ${m.goalsB}` : "vs"}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: m.winner?.id === m.b?.id ? "#5DCAA5" : "#9089c0",
                      }}
                    >
                      {m.b ? m.b.name : "—"}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <Btn onClick={() => setPhase("setup")}>Nuevo torneo</Btn>
        </div>
      );
    }

    const sideStyle = (side: Entrant<number> | null, m: Match<number>) => ({
      display: "flex" as const,
      alignItems: "center" as const,
      gap: 8,
      minWidth: 0,
      flex: 1,
      opacity: m.winner && m.winner.id !== side?.id ? 0.45 : 1,
    });
    const nameStyle = (side: Entrant<number> | null, m: Match<number>) => ({
      margin: 0,
      fontWeight: 700 as const,
      fontSize: 13,
      minWidth: 0,
      overflow: "hidden" as const,
      textOverflow: "ellipsis" as const,
      whiteSpace: "nowrap" as const,
      color: m.winner?.id === side?.id ? "#5DCAA5" : "#e8e4f0",
    });
    const teamStyle = {
      margin: 0,
      fontSize: 11,
      color: "#7F77DD",
      overflow: "hidden" as const,
      textOverflow: "ellipsis" as const,
      whiteSpace: "nowrap" as const,
    };

    return (
      <div>
        {rounds!.map((round, ri) => (
          <div key={ri} style={{ marginBottom: 18 }}>
            <span style={{ ...S.label, marginBottom: 12 }}>{roundNames[ri]}</span>
            {round.map((m, mi) => {
              const editing = editingMatch && editingMatch.roundIdx === ri && editingMatch.matchIdx === mi;
              const playable = m.a && m.b && !m.winner;
              const decided = m.winner != null;
              return (
                <div key={mi} style={{ ...S.cardHighlight, marginBottom: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={sideStyle(m.a, m)}>
                      {m.a ? (
                        <Avatar name={m.a.name} size={30} />
                      ) : (
                        <div
                          style={{ width: 30, height: 30, borderRadius: "50%", border: "1px dashed rgba(127,119,221,0.3)", flexShrink: 0 }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={nameStyle(m.a, m)}>{m.a ? m.a.name : "Por definir"}</p>
                        {m.a && <p style={teamStyle}>{m.a.team}</p>}
                      </div>
                    </div>

                    <div style={{ flexShrink: 0, textAlign: "center", minWidth: 46 }}>
                      {m.goalsA != null ? (
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#AFA9EC" }}>
                          {m.goalsA} - {m.goalsB}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b6490" }}>vs</span>
                      )}
                    </div>

                    <div style={{ ...sideStyle(m.b, m), flexDirection: "row-reverse" as const, textAlign: "right" as const }}>
                      {m.b ? (
                        <Avatar name={m.b.name} size={30} />
                      ) : (
                        <div
                          style={{ width: 30, height: 30, borderRadius: "50%", border: "1px dashed rgba(127,119,221,0.3)", flexShrink: 0 }}
                        />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={nameStyle(m.b, m)}>{m.b ? m.b.name : "Por definir"}</p>
                        {m.b && <p style={teamStyle}>{m.b.team}</p>}
                      </div>
                    </div>
                  </div>

                  {playable && !editing && (
                    <Btn variant="ghost" onClick={() => openMatch(ri, mi)} style={{ marginTop: 12 }}>
                      Cargar resultado
                    </Btn>
                  )}

                  {playable && editing && !trackGoals && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, m.a)} style={{ fontSize: 13 }}>
                        Ganó {m.a!.name}
                      </Btn>
                      <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, m.b)} style={{ fontSize: 13 }}>
                        Ganó {m.b!.name}
                      </Btn>
                    </div>
                  )}

                  {playable && editing && trackGoals && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <span
                          style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {m.a!.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          style={{ ...S.input, width: 60, flexShrink: 0, textAlign: "center" }}
                          value={scoreInput.goalsA}
                          onChange={e => setScoreInput(s => ({ ...s, goalsA: e.target.value }))}
                        />
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                        <span
                          style={{ fontSize: 13, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {m.b!.name}
                        </span>
                        <input
                          type="number"
                          min="0"
                          style={{ ...S.input, width: 60, flexShrink: 0, textAlign: "center" }}
                          value={scoreInput.goalsB}
                          onChange={e => setScoreInput(s => ({ ...s, goalsB: e.target.value }))}
                        />
                      </div>
                      <Btn variant="success" onClick={() => confirmScore(ri, mi)}>
                        Confirmar resultado
                      </Btn>
                    </div>
                  )}

                  {decided && !playable && m.a && m.b && (
                    <p style={{ ...S.muted, marginTop: 8, textAlign: "center" }}>
                      Ganó {m.winner!.name} · {m.winner!.team}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <Btn variant="ghost" onClick={() => setPhase("setup")}>
          Cancelar torneo
        </Btn>
      </div>
    );
  }

  return null;
}
