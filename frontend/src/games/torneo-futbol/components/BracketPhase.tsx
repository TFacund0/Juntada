import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Btn } from "../../../components/ui/Btn";
import { Avatar } from "../../../components/ui/Avatar";
import type { RoundViewProps } from "../../gameTypes";
import type { Entrant, Match } from "../types/roundView";
import { ROUND_NAMES } from "../types/roundView";

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

  const sideClass = (side: Entrant | null, m: Match) => T.matchSide(!!m.winner && m.winner.id !== side?.id);
  const nameClass = (side: Entrant | null, m: Match) => T.matchSideName(m.winner?.id === side?.id);

  // La ronda "activa" es la primera que todavía tiene algún partido sin
  // decidir — una vez que todos los partidos de una ronda tienen ganador, el
  // torneo ya avanzó a la siguiente (propagateByes ya corrió los cruces).
  const currentRoundIdx = rounds.findIndex(r => r.some(m => !m.winner));
  const activeRoundIdx = currentRoundIdx === -1 ? rounds.length - 1 : currentRoundIdx;

  return (
    <div>
      <p className="mb-2 text-center text-[13px] text-[#9089c0]">
        {roundNames[activeRoundIdx]} ({activeRoundIdx + 1}/{rounds.length})
      </p>
      {!isHost && (
        <div className={clsx(T.cardHighlight, "text-center mb-4")}>
          <p className="m-0 text-[13px] text-[#9089c0]">El anfitrión va cargando los resultados a medida que se juegan los partidos.</p>
        </div>
      )}
      {rounds.map((round, ri) => (
        <div key={ri} className="mb-[18px]">
          <span className={clsx(T.label, "mb-3")}>
            {roundNames[ri]} ({ri + 1}/{rounds.length})
          </span>
          {round.map((m, mi) => {
            const editing = editingMatch && editingMatch.roundIdx === ri && editingMatch.matchIdx === mi;
            const playable = m.a && m.b && !m.winner;
            const decided = m.winner != null;
            const involvesMe = myPlayer && (m.a?.id === myPlayer.id || m.b?.id === myPlayer.id);
            return (
              <div key={mi} className={T.matchCard(!!(involvesMe && playable))}>
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

                {isHost && playable && !editing && (
                  <Btn variant="ghost" onClick={() => openMatch(ri, mi)} className="mt-3">
                    Cargar resultado
                  </Btn>
                )}

                {isHost && playable && editing && !trackGoals && (
                  <div className="mt-3 flex gap-2">
                    <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, "a")} className="text-[13px]">
                      Ganó {m.a!.name}
                    </Btn>
                    <Btn variant="success" onClick={() => confirmWinnerSimple(ri, mi, "b")} className="text-[13px]">
                      Ganó {m.b!.name}
                    </Btn>
                  </div>
                )}

                {isHost && playable && editing && trackGoals && (
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

                {!isHost && playable && (
                  <p className={clsx(T.muted, "mt-2 text-center")}>
                    {involvesMe ? "Es tu partido — esperá a que el anfitrión cargue el resultado." : "Esperando resultado..."}
                  </p>
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
    </div>
  );
}
