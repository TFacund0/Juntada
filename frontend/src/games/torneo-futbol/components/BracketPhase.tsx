import { useState } from "react";
import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { Avatar } from "../../../components/Avatar";
import type { RoundViewProps } from "../../gameTypes";
import type { Entrant, Match } from "../types";
import { ROUND_NAMES } from "../types";

// ── BRACKET EN VIVO: cruces + carga de resultado (solo el anfitrión) ──
export function BracketPhase({
  room,
  myPlayer,
  isHost,
  send,
  rounds,
  trackGoals,
}: Pick<RoundViewProps, "room" | "myPlayer" | "isHost" | "send"> & { rounds: Match[][]; trackGoals: boolean }) {
  const roundNames = ROUND_NAMES(rounds.length);
  const [editingMatch, setEditingMatch] = useState<{ roundIdx: number; matchIdx: number } | null>(null);
  const [scoreInput, setScoreInput] = useState({ goalsA: "", goalsB: "" });

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

  // La ronda "activa" es la primera que todavía tiene algún partido sin
  // decidir — una vez que todos los partidos de una ronda tienen ganador, el
  // torneo ya avanzó a la siguiente (propagateByes ya corrió los cruces).
  const currentRoundIdx = rounds.findIndex(r => r.some(m => !m.winner));
  const activeRoundIdx = currentRoundIdx === -1 ? rounds.length - 1 : currentRoundIdx;

  return (
    <div>
      <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 8 }}>
        {roundNames[activeRoundIdx]} ({activeRoundIdx + 1}/{rounds.length})
      </p>
      {!isHost && (
        <div style={{ ...S.cardHighlight, textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "#9089c0", margin: 0 }}>
            El anfitrión va cargando los resultados a medida que se juegan los partidos.
          </p>
        </div>
      )}
      {rounds.map((round, ri) => (
        <div key={ri} style={{ marginBottom: 18 }}>
          <span style={{ ...S.label, marginBottom: 12 }}>
            {roundNames[ri]} ({ri + 1}/{rounds.length})
          </span>
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
