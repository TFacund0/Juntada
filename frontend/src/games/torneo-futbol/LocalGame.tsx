import { useState } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { ConfirmBackButton } from "../../components/game-kit/ConfirmBackButton";
import { Avatar } from "../../components/ui/Avatar";
import { SetupTabs, type SetupTab } from "../../components/setup/SetupTabs";
import { StickyActionBar } from "../../components/setup/StickyActionBar";
import { TeamConfigPanel } from "./components/TeamConfigPanel";
import { buildBracket, propagateByes } from "@juntada/torneo-futbol-bracket";
import type { Entrant, Match } from "@juntada/torneo-futbol-bracket";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { useFlashError } from "../../hooks/ui/useFlashError";
import { nextPlayerName } from "../../utils/nextPlayerName";

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
      <div className="pb-[88px]">
        <SetupTabs tab={tab} onChange={setTab} />

        {tab === "players" && (
          <div className={T.card}>
            <span className={T.label}>Jugadores ({players.length})</span>
            {players.map(p => (
              <div key={p.id} className="mb-2 flex items-center gap-2">
                <Avatar name={p.name} size={32} />
                <input className={clsx(T.input, "flex-1 min-w-0")} value={p.name} onChange={e => renamePlayer(p.id, e.target.value)} />
                <button onClick={() => setPlayers(prev => prev.filter(x => x.id !== p.id))} className={T.squareIconBtn("danger")}>
                  ×
                </button>
              </div>
            ))}
            <div className="mt-2.5 flex gap-2">
              <input
                className={clsx(T.input, "flex-1")}
                placeholder="Nombre"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") addPlayer();
                }}
              />
              <Btn variant="ghost" onClick={addPlayer} className="w-auto px-[18px] py-[11px]">
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
          {startDisabledReason && <p className={clsx(T.muted, "text-center mt-2")}>{startDisabledReason}</p>}
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
          <div className="text-center p-[10px_0_20px]">
            <div className="text-[56px]">🏆</div>
            <p className={T.title}>{champion.name}</p>
            <p className="mt-1 text-[15px] font-bold text-[#7F77DD]">Campeón del torneo con {champion.team}</p>
          </div>

          {trackGoals && (
            <div className={T.card}>
              <span className={T.label}>Tabla de jugadores</span>
              <div className={T.statTableHeader}>
                <span className="flex-1">Jugador</span>
                <span className={T.statTableHeaderCol}>PJ</span>
                <span className={T.statTableHeaderCol}>GF</span>
                <span className={T.statTableHeaderCol}>GC</span>
                <span className={T.statTableHeaderCol}>DG</span>
              </div>
              {s.map(row => (
                <div key={row.player.id} className={T.statTableRow}>
                  <span className="flex flex-1 min-w-0 items-center gap-2">
                    <Avatar name={row.player.name} size={24} />
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{row.player.name}</span>
                    {row.player.id === champion.id && (
                      <span title="Campeón" className="shrink-0">
                        🏆
                      </span>
                    )}
                  </span>
                  <span className={clsx(T.statTableCol, "text-[#9089c0]")}>{row.played}</span>
                  <span className={clsx(T.statTableCol, "text-[#5DCAA5]")}>{row.goalsFor}</span>
                  <span className={clsx(T.statTableCol, "text-[#F09595]")}>{row.goalsAgainst}</span>
                  <span className={T.statTableColWide(true)}>
                    {row.goalsFor - row.goalsAgainst >= 0 ? "+" : ""}
                    {row.goalsFor - row.goalsAgainst}
                  </span>
                </div>
              ))}
            </div>
          )}

          {trackGoals && (
            <div className={T.card}>
              <span className={T.label}>Estadísticas del torneo</span>
              {topScorer && topScorer.goalsFor > 0 && (
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="text-xl">⚽</span>
                  <span className="text-[13px]">
                    Máximo goleador: <strong className="text-[#5DCAA5]">{topScorer.player.name}</strong> ({topScorer.goalsFor} goles)
                  </span>
                </div>
              )}
              {leakiest && leakiest.goalsAgainst > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🥅</span>
                  <span className="text-[13px]">
                    Valla más goleada: <strong className="text-[#F09595]">{leakiest.player.name}</strong> ({leakiest.goalsAgainst}{" "}
                    recibidos)
                  </span>
                </div>
              )}
            </div>
          )}

          <div className={T.card}>
            <span className={T.label}>Camino del torneo</span>
            {rounds!.map((round, ri) => (
              <div key={ri} className="mb-2.5">
                <p className={T.pathRoundLabel}>{roundNames[ri]}</p>
                {round.map((m, mi) => (
                  <div key={mi} className={T.pathMatchRow}>
                    <span className={clsx(T.pathEntrantName(m.winner?.id === m.a?.id), "text-right")}>{m.a ? m.a.name : "—"}</span>
                    <span className="shrink-0 text-xs text-[#6b6490]">{m.goalsA != null ? `${m.goalsA} - ${m.goalsB}` : "vs"}</span>
                    <span className={T.pathEntrantName(m.winner?.id === m.b?.id)}>{m.b ? m.b.name : "—"}</span>
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

    const sideClass = (side: Entrant<number> | null, m: Match<number>) => T.matchSide(!!m.winner && m.winner.id !== side?.id);
    const nameClass = (side: Entrant<number> | null, m: Match<number>) => T.matchSideName(m.winner?.id === side?.id);

    return (
      <div>
        {rounds!.map((round, ri) => (
          <div key={ri} className="mb-[18px]">
            <span className={clsx(T.label, "mb-3")}>{roundNames[ri]}</span>
            {round.map((m, mi) => {
              const editing = editingMatch && editingMatch.roundIdx === ri && editingMatch.matchIdx === mi;
              const playable = m.a && m.b && !m.winner;
              const decided = m.winner != null;
              return (
                <div key={mi} className={T.matchCard(false)}>
                  <div className="flex items-center gap-2.5">
                    <div className={sideClass(m.a, m)}>
                      {m.a ? <Avatar name={m.a.name} size={30} /> : <div className={T.avatarPlaceholder} />}
                      <div className="min-w-0">
                        <p className={nameClass(m.a, m)}>{m.a ? m.a.name : "Por definir"}</p>
                        {m.a && <p className={T.matchSideTeam}>{m.a.team}</p>}
                      </div>
                    </div>

                    <div className="min-w-[46px] shrink-0 text-center">
                      {m.goalsA != null ? (
                        <span className="text-base font-extrabold text-[#AFA9EC]">
                          {m.goalsA} - {m.goalsB}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-[#6b6490]">vs</span>
                      )}
                    </div>

                    <div className={clsx(sideClass(m.b, m), "flex-row-reverse text-right")}>
                      {m.b ? <Avatar name={m.b.name} size={30} /> : <div className={T.avatarPlaceholder} />}
                      <div className="min-w-0">
                        <p className={nameClass(m.b, m)}>{m.b ? m.b.name : "Por definir"}</p>
                        {m.b && <p className={T.matchSideTeam}>{m.b.team}</p>}
                      </div>
                    </div>
                  </div>

                  {playable && !editing && (
                    <Btn variant="ghost" onClick={() => openMatch(ri, mi)} className="mt-3">
                      Cargar resultado
                    </Btn>
                  )}

                  {playable && editing && !trackGoals && (
                    <div className="mt-3 flex gap-2">
                      <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, m.a)} className="text-[13px]">
                        Ganó {m.a!.name}
                      </Btn>
                      <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, m.b)} className="text-[13px]">
                        Ganó {m.b!.name}
                      </Btn>
                    </div>
                  )}

                  {playable && editing && trackGoals && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">{m.a!.name}</span>
                        <input
                          type="number"
                          min="0"
                          className={clsx(T.input, "w-[60px] shrink-0 text-center")}
                          value={scoreInput.goalsA}
                          onChange={e => setScoreInput(s => ({ ...s, goalsA: e.target.value }))}
                        />
                      </div>
                      <div className="mb-2.5 flex items-center gap-2">
                        <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">{m.b!.name}</span>
                        <input
                          type="number"
                          min="0"
                          className={clsx(T.input, "w-[60px] shrink-0 text-center")}
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
                    <p className={clsx(T.muted, "mt-2 text-center")}>
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
