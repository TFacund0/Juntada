import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { BackButton } from "../../components/BackButton";
import { Avatar } from "../../components/Avatar";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import type { RoundViewProps } from "../gameTypes";

// ═══════════════════════════════════════════════════════════════════════════════
// TORNEO DE FÚTBOL — vista compartida del bracket en modo online. Todos los que
// están en la sala ven los mismos cruces y resultados en vivo; solo el
// anfitrión puede cargar el resultado de un partido (send "report_result").
// ═══════════════════════════════════════════════════════════════════════════════

interface Entrant {
  id: string;
  name: string;
  team: string;
}

interface Match {
  a: Entrant | null;
  b: Entrant | null;
  winner: Entrant | null;
  goalsA: number | null;
  goalsB: number | null;
}

const ROUND_NAMES = (totalRounds: number): string[] => {
  const names = ["Final", "Semifinal", "Cuartos de final", "Octavos de final", "Dieciseisavos de final"];
  return Array.from({ length: totalRounds }, (_, i) => names[totalRounds - 1 - i] || `Ronda ${i + 1}`);
};

export function RoundView({ room, myPlayer, isHost, send }: RoundViewProps) {
  const { rounds, trackGoals } = room.round as { rounds: Match[][]; trackGoals: boolean };
  const roundNames = ROUND_NAMES(rounds.length);
  const champion = room.phase === "champion" ? rounds[rounds.length - 1][0].winner : null;
  const [editingMatch, setEditingMatch] = useState<{ roundIdx: number; matchIdx: number } | null>(null);
  const [scoreInput, setScoreInput] = useState({ goalsA: "", goalsB: "" });
  // No dedicated tournament counter — total reported matches ticks up as the
  // bracket fills and resets to 0 for a fresh tournament, which is enough to
  // restart the countdown once per championship.
  const matchesReported = rounds.reduce((sum, r) => sum + r.filter(m => m.goalsA != null || m.winner).length, 0);
  const revealCount = useRevealCountdown(matchesReported);

  const openMatch = (roundIdx: number, matchIdx: number) => {
    setEditingMatch({ roundIdx, matchIdx });
    setScoreInput({ goalsA: "", goalsB: "" });
  };

  const confirmWinnerSimple = (roundIdx: number, matchIdx: number, side: "a" | "b") => {
    send({ type: "report_result", roundIdx, matchIdx, winnerSide: side });
    setEditingMatch(null);
  };

  const confirmScore = (roundIdx: number, matchIdx: number) => {
    const ga = parseInt(scoreInput.goalsA, 10);
    const gb = parseInt(scoreInput.goalsB, 10);
    if (Number.isNaN(ga) || Number.isNaN(gb) || ga < 0 || gb < 0 || ga === gb) return;
    send({ type: "report_result", roundIdx, matchIdx, goalsA: ga, goalsB: gb });
    setEditingMatch(null);
  };

  const stats = () => {
    const tally: Record<
      string,
      { player: { id: string; name: string }; goalsFor: number; goalsAgainst: number; played: number; won: number }
    > = {};
    room.players.forEach(p => {
      tally[p.id] = { player: p, goalsFor: 0, goalsAgainst: 0, played: 0, won: 0 };
    });
    rounds.forEach(round =>
      round.forEach(m => {
        if (m.goalsA == null || m.goalsB == null || !m.a || !m.b) return;
        if (!tally[m.a.id] || !tally[m.b.id]) return;
        tally[m.a.id].goalsFor += m.goalsA;
        tally[m.a.id].goalsAgainst += m.goalsB;
        tally[m.a.id].played++;
        tally[m.b.id].goalsFor += m.goalsB;
        tally[m.b.id].goalsAgainst += m.goalsA;
        tally[m.b.id].played++;
        if (m.winner && tally[m.winner.id]) tally[m.winner.id].won++;
      }),
    );
    return Object.values(tally);
  };

  // ── CHAMPION ──
  if (room.phase === "champion" && champion) {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando al campeón..." />;
    const s = stats().sort((a, b) => b.goalsFor - a.goalsFor);
    const topScorer = trackGoals && s.length ? s[0] : null;
    const leakiest = trackGoals && s.length ? [...s].sort((a, b) => b.goalsAgainst - a.goalsAgainst)[0] : null;
    const amIChampion = myPlayer && champion.id === myPlayer.id;
    return (
      <div>
        <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
          <div style={{ fontSize: 56 }}>🏆</div>
          <p style={S.title}>{champion.name}</p>
          <p style={{ color: "#7F77DD", fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            {amIChampion ? "¡Sos el campeón del torneo!" : "Campeón del torneo"} con {champion.team}
          </p>
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
              <span style={{ width: 32, flexShrink: 0, textAlign: "center" }}>PJ</span>
              <span style={{ width: 32, flexShrink: 0, textAlign: "center" }}>GF</span>
              <span style={{ width: 32, flexShrink: 0, textAlign: "center" }}>GC</span>
              <span style={{ width: 40, flexShrink: 0, textAlign: "center" }}>DG</span>
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
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.player.name}</span>
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
          {rounds.map((round, ri) => (
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

        {/* Group instances use the shell's persistent "Volver al grupo" link instead. */}
        {isHost && room.groupCode === null && <BackButton onClick={() => send({ type: "back_to_lobby" })}>Volver al lobby</BackButton>}
      </div>
    );
  }

  // ── BRACKET EN VIVO ──
  const sideStyle = (side: Entrant | null, m: Match) => ({
    display: "flex" as const,
    alignItems: "center" as const,
    gap: 8,
    minWidth: 0,
    flex: 1,
    opacity: m.winner && m.winner.id !== side?.id ? 0.45 : 1,
  });
  const nameStyle = (side: Entrant | null, m: Match) => ({
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
      {!isHost && (
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#9089c0", margin: 0 }}>
            El anfitrión va cargando los resultados a medida que se juegan los partidos.
          </p>
        </div>
      )}
      {rounds.map((round, ri) => (
        <div key={ri} style={{ marginBottom: 18 }}>
          <span style={{ ...S.label, marginBottom: 12 }}>{roundNames[ri]}</span>
          {round.map((m, mi) => {
            const editing = editingMatch && editingMatch.roundIdx === ri && editingMatch.matchIdx === mi;
            const playable = m.a && m.b && !m.winner;
            const decided = m.winner != null;
            const involvesMe = myPlayer && (m.a?.id === myPlayer.id || m.b?.id === myPlayer.id);
            return (
              <div
                key={mi}
                style={{
                  ...S.cardHighlight,
                  marginBottom: 10,
                  padding: "14px 16px",
                  border: involvesMe && playable ? "1px solid rgba(93,202,165,0.5)" : undefined,
                }}
              >
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

                {isHost && playable && !editing && (
                  <Btn variant="ghost" onClick={() => openMatch(ri, mi)} style={{ marginTop: 12 }}>
                    Cargar resultado
                  </Btn>
                )}

                {isHost && playable && editing && !trackGoals && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, "a")} style={{ fontSize: 13 }}>
                      Ganó {m.a!.name}
                    </Btn>
                    <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, "b")} style={{ fontSize: 13 }}>
                      Ganó {m.b!.name}
                    </Btn>
                  </div>
                )}

                {isHost && playable && editing && trackGoals && (
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

                {!isHost && playable && (
                  <p style={{ ...S.muted, marginTop: 8, textAlign: "center" }}>
                    {involvesMe ? "Es tu partido — esperá a que el anfitrión cargue el resultado." : "Esperando resultado..."}
                  </p>
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
    </div>
  );
}
