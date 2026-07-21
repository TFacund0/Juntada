import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { ConfirmBackButton } from "../../components/ConfirmBackButton";
import { Avatar } from "../../components/Avatar";
import { SetupTabs, type SetupTab } from "../../components/SetupTabs";
import { StickyActionBar } from "../../components/StickyActionBar";
import { TeamConfigPanel } from "./team-config/TeamConfigPanel";
import { buildBracket, propagateByes } from "@juntada/torneo-futbol-bracket";
import type { Entrant, Match } from "@juntada/torneo-futbol-bracket";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useFlashError } from "../../hooks/useFlashError";
import { nextPlayerName } from "../../utils/playerNames";

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEO DE FÚTBOL — un solo dispositivo. Mismo esquema de setup que el modo
// online (SetupTabs Jugadores/Configuración, con la Configuración partida en
// Equipos/Asignar/Cruces — ver ConfigPanel.tsx): todo se arma en una sola
// pantalla con pestañas en vez de una serie de pasos separados, porque acá no
// hay "pasarle el dispositivo a alguien" de por medio (a diferencia de, por
// ejemplo, Sintonía) — el sorteo de equipos y el orden de cruces los arma
// quien tiene el dispositivo en mano, todos mirando la misma pantalla, igual
// que el anfitrión online. Al confirmar arranca directo el bracket de
// eliminación directa (con byes si el número de jugadores no es potencia de
// 2), con carga de resultados y goleador opcional, y pantalla final con
// campeón + estadísticas.
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

const ROUND_NAMES = (totalRounds: number): string[] => {
  const names = ["Final", "Semifinal", "Cuartos de final", "Octavos de final", "Dieciseisavos de final"];
  return Array.from({ length: totalRounds }, (_, i) => names[totalRounds - 1 - i] || `Ronda ${i + 1}`);
};

export function LocalGame() {
  const [phase, setPhase] = useState<"setup" | "bracket" | "champion">("setup");
  const [tab, setTab] = useState<SetupTab>("players");
  const [players, setPlayers] = useState<LocalPlayer[]>([
    { id: 1, name: "Jugador 1" },
    { id: 2, name: "Jugador 2" },
    { id: 3, name: "Jugador 3" },
    { id: 4, name: "Jugador 4" },
  ]);
  const [newName, setNewName] = useState("");
  const [teams, setTeams] = useState(DEFAULT_TEAMS.slice(0, 8));
  const [trackGoals, setTrackGoals] = useState(true);
  const [assignments, setAssignments] = useState<Record<number, string>>({}); // playerId -> team
  const [nameError, nameErrorKey, setNameError] = useFlashError();
  // Persisted only when explicitly reordered (moveSeed/randomizeSeed inside
  // TeamConfigPanel) — same derive-then-fall-back-to-player-order pattern as
  // the online ConfigPanel, so adding/removing a player never leaves a
  // stale/incomplete order lying around waiting to be used.
  const [seedOrder, setSeedOrder] = useState<number[]>([]);
  const [rounds, setRounds] = useState<Match<number>[][] | null>(null);
  const [scoreInput, setScoreInput] = useState({ goalsA: "", goalsB: "" });
  const [editingMatch, setEditingMatch] = useState<{ roundIdx: number; matchIdx: number } | null>(null);

  const allAssigned = players.length > 0 && players.every(p => assignments[p.id]);
  const validSeed = seedOrder.length === players.length && players.every(p => seedOrder.includes(p.id));
  const order = validSeed ? seedOrder : players.map(p => p.id);

  const isDuplicateName = (name: string, excludeId: number | null) => {
    const norm = name.trim().toLowerCase();
    return players.some(p => p.id !== excludeId && p.name.trim().toLowerCase() === norm);
  };

  const addPlayer = () => {
    const trimmed = newName.trim() || nextPlayerName(players.map(p => p.name));
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

  const canStart = players.length >= 2 && teams.length >= players.length && allAssigned;

  const startTournament = () => {
    if (!canStart) return;
    const entrants: Entrant<number>[] = order.map(id => {
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
      const match = next[roundIdx]?.[matchIdx];
      // Mirrors the online engine's own guard on report_result — a match
      // that's already decided, missing an entrant, or plain out of range
      // shouldn't be overwritable, even though single-device play makes a
      // stale double-tap unlikely rather than impossible.
      if (!match || !match.a || !match.b || match.winner) return prev!;
      match.winner = winner;
      propagateByes(next);
      return next;
    });
    setEditingMatch(null);
  };

  const confirmScore = (roundIdx: number, matchIdx: number) => {
    const ga = parseInt(scoreInput.goalsA, 10);
    const gb = parseInt(scoreInput.goalsB, 10);
    if (Number.isNaN(ga) || Number.isNaN(gb) || ga < 0 || gb < 0 || ga === gb) return;
    setRounds(prev => {
      const next = prev!.map(r => r.map(m => ({ ...m })));
      const match = next[roundIdx]?.[matchIdx];
      if (!match || !match.a || !match.b || match.winner) return prev!;
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

  // ── SETUP (jugadores y configuración: equipos, asignación, cruces) ──
  if (phase === "setup") {
    const startDisabledReason =
      players.length < 2
        ? "Necesitás mínimo 2 jugadores"
        : teams.length < players.length
          ? "Necesitás al menos un equipo por jugador"
          : !allAssigned
            ? "Asigná un equipo a cada jugador antes de iniciar"
            : null;

    return (
      <div style={{ paddingBottom: 88 }}>
        <SetupTabs tab={tab} onChange={setTab} />

        {tab === "players" && (
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
            <ErrorBanner message={nameError} flashKey={nameErrorKey} variant="inline" />
          </div>
        )}

        {tab === "config" && (
          <TeamConfigPanel
            players={players}
            teams={teams}
            onAddTeam={name => setTeams(t => [...t, name])}
            onRemoveTeam={name => setTeams(t => t.filter(x => x !== name))}
            assignments={assignments}
            setAssignments={setAssignments}
            seedOrder={seedOrder}
            setSeedOrder={setSeedOrder}
            trackGoals={trackGoals}
            onToggleTrackGoals={() => setTrackGoals(v => !v)}
          />
        )}

        <StickyActionBar>
          <StartButton onClick={startTournament} disabled={!canStart}>
            Empezar torneo
          </StartButton>
          {startDisabledReason && <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>{startDisabledReason}</p>}
        </StickyActionBar>
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

          <StartButton
            onClick={() => {
              // A "new" tournament should feel like one — otherwise every
              // player still shows up pre-assigned to their old team from
              // the tournament that just ended, with no prompt to re-sort,
              // which reads as the button not having done anything.
              setAssignments({});
              setSeedOrder([]);
              setRounds(null);
              setPhase("setup");
            }}
          >
            Nuevo torneo
          </StartButton>
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
        <ConfirmBackButton
          title="¿Cancelar el torneo?"
          message="Se pierde todo el progreso del bracket y los resultados ya cargados — no se puede deshacer."
          confirmLabel="Sí, cancelar"
          onConfirm={() => setPhase("setup")}
        >
          Cancelar torneo
        </ConfirmBackButton>
      </div>
    );
  }

  return null;
}
