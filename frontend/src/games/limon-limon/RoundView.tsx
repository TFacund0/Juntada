import { useEffect, useState } from "react";
import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { Btn } from "../../components/ui/Btn";
import { StartButton } from "../../components/setup/StartButton";
import { LeaveToLobbyButton } from "../../components/game-kit/LeaveToLobbyButton";
import { Avatar } from "../../components/ui/Avatar";
import { CardView, DeckStack } from "./components/CardView";
import { AssignPicker } from "./components/AssignPicker";
import { DescriptionToggle } from "./components/DescriptionToggle";
import { ScoreToggleButton } from "./components/ScoreToggleButton";
import { cardKey, getDescription } from "./deck";
import { RevealCountdown, useRevealCountdown } from "../../components/game-kit/RevealCountdown";
import { PhaseTransition } from "../../components/game-kit/PhaseTransition";
import type { RoundViewProps } from "../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";
import type { Card } from "@juntada/limon-limon-deck";

// Mirrors backend/src/games/limon-limon/engine.ts's getPublicRoundView.
interface LimonLimonRoundState {
  remaining: number;
  current: Card | null;
  turnId: string;
  order: string[];
  pileCounts: Record<string, number>;
  history: (Card & { eatenBy: string })[];
  endVotes: string[];
  endVoteThreshold: number;
}

function TurnOrder({ players, order, turnId }: { players: PublicPlayer[]; order: string[]; turnId: string }) {
  const ordered = order.map(id => players.find(p => p.id === id)).filter((p): p is PublicPlayer => Boolean(p));
  return (
    <div className={clsx(T.card, "mb-3.5")}>
      <span className={T.label}>Orden de turno</span>
      <div className="flex flex-wrap gap-2">
        {ordered.map(p => {
          const active = p.id === turnId;
          return (
            <div key={p.id} className={T.turnChip(active)}>
              <Avatar name={p.name} size={20} />
              <span className={T.turnChipLabel(active)}>{p.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ranking({ players, pileCounts }: { players: PublicPlayer[]; pileCounts: Record<string, number> }) {
  const ranked = players.map(p => ({ ...p, count: pileCounts[p.id] || 0 })).sort((a, b) => b.count - a.count);
  const maxCount = ranked[0]?.count ?? 0;
  return (
    <div className={T.card}>
      <span className={T.label}>Cartas acumuladas</span>
      {ranked.map((p, i) => (
        <div key={p.id} className={T.rankRow(i === ranked.length - 1)}>
          <span className={T.rankIndex}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span className={T.rankName}>
            {p.name}
            {!p.online ? " (desconectado)" : ""}
          </span>
          {p.count === maxCount && maxCount > 0 && <span style={{ fontSize: 11, color: "#F09595", fontWeight: 700 }}>pierde</span>}
          <span className={T.rankValue(p.count === maxCount && maxCount > 0)}>{p.count}</span>
        </div>
      ))}
    </div>
  );
}

// Ronda online: el mazo vive en el server (room.round), cada uno lo ve desde
// su propio dispositivo. Solo quien tiene el turno puede tocar el mazo y,
// una vez revelada la carta, elegir manualmente (según lo que decida el
// grupo en voz/chat) quién se la come.
export function RoundView({ room, me, isHost, send }: RoundViewProps) {
  const [showRanking, setShowRanking] = useState(false);
  const [showEndVote, setShowEndVote] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null); // elegido, no confirmado todavía
  const round = room.round as LimonLimonRoundState | null;
  // No standalone match counter on this engine — the pile distribution is a
  // stable stand-in: it only changes once a new deck starts.
  const revealCount = useRevealCountdown(round ? JSON.stringify(round.pileCounts) : "");
  // La carta actual la decide el server — si cambia (nueva carta revelada, o
  // se acaba de asignar la anterior) cualquier selección pendiente quedó
  // obsoleta.
  useEffect(() => {
    setSelectedAssignee(null);
  }, [round?.current]);
  if (!round) return null;

  const turnPlayer = room.players.find(p => p.id === round.turnId);
  const myTurn = !!me && round.turnId === me.playerId;
  const descriptions: Record<string, string> = (room.config.descriptions as Record<string, string>) || {};

  if (room.phase === "round") {
    return (
      <PhaseTransition phaseKey={`${round.turnId}-${round.current ? "revealed" : "waiting"}`}>
        <div>
          <TurnOrder players={room.players} order={round.order || []} turnId={round.turnId} />

          {!round.current && (
            <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
              {myTurn ? (
                <>
                  Tu turno — <strong style={{ color: "#5DCAA5" }}>tocá el mazo</strong>
                </>
              ) : (
                <>
                  Turno de <strong>{turnPlayer?.name}</strong>
                </>
              )}
            </p>
          )}

          <div className={T.deckCardWrap}>
            <DeckStack cardsLeft={round.remaining} />
            <div style={{ position: "relative" }}>
              <CardView card={round.current} onClick={myTurn && !round.current ? () => send({ type: "reveal" }) : undefined} />
            </div>
          </div>

          <p className={clsx(T.muted, "mt-2.5 text-center")}>Quedan {round.remaining} cartas en el mazo</p>

          {round.current && (
            <div style={{ marginTop: 14 }}>
              <DescriptionToggle
                key={cardKey(round.current.suit, round.current.value)}
                description={getDescription(descriptions, round.current)}
              />
            </div>
          )}

          {round.current && (
            <div className={clsx(T.cardHighlight, "mt-3.5")}>
              {myTurn ? (
                <>
                  <AssignPicker
                    players={room.players}
                    selected={selectedAssignee}
                    onSelect={setSelectedAssignee}
                    onConfirm={() => send({ type: "assign", targetId: selectedAssignee })}
                  />
                </>
              ) : (
                <p className={clsx(T.muted, "text-center")}>Esperando que {turnPlayer?.name} reparta la carta</p>
              )}
            </div>
          )}

          <ScoreToggleButton show={showRanking} onToggle={() => setShowRanking(v => !v)} />
          {showRanking && <Ranking players={room.players} pileCounts={round.pileCounts} />}

          {/* Chico a propósito — terminar antes es la excepción, no algo a lo
            que se quiera empujar al grupo — pero en rojo como el resto de
            los "terminar partida" del modo local, ya que corta el juego. */}
          <div className="mt-[18px] text-center">
            <button onClick={() => setShowEndVote(v => !v)} className={clsx(T.btn("danger"), "w-auto px-3.5 py-1.5 text-xs")}>
              {(round.endVotes || []).length > 0 ? `Terminar antes (${round.endVotes.length}/${round.endVoteThreshold})` : "Terminar antes"}
            </button>
            {showEndVote && (
              <div className={clsx(T.card, "mt-2.5 text-left")}>
                <p className={clsx(T.muted, "mb-2.5")}>
                  Con la mitad de los jugadores votando, se corta la partida y se muestra la tabla como está ahora.
                  {round.current && " La carta que está revelada ahora mismo quedaría sin repartir, sin sumarle a nadie."}
                </p>
                {me && (round.endVotes || []).includes(me.playerId) ? (
                  <p className={clsx(T.muted, "m-0")}>Votaste terminar — esperando al resto</p>
                ) : (
                  <Btn variant="ghost" onClick={() => send({ type: "vote_end" })}>
                    Votar para terminar
                  </Btn>
                )}
              </div>
            )}
          </div>
        </div>
      </PhaseTransition>
    );
  }

  if (room.phase === "result") {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando la tabla final..." />;
    return (
      <PhaseTransition phaseKey="result">
        <div>
          <div className={clsx(T.cardHighlight, "text-center")}>
            <p className={T.bigReveal}>{round.remaining > 0 ? "Partida terminada por votación" : "Se acabó el mazo"}</p>
          </div>
          {round.current && (
            <div className={clsx(T.card, "text-center")}>
              <span className={T.label}>Quedó sin repartir</span>
              <CardView card={round.current} size="small" />
              <p className={clsx(T.muted, "mt-2")}>
                Se votó terminar justo cuando se estaba por decidir quién se la quedaba, así que no se le sumó a nadie.
              </p>
            </div>
          )}
          <Ranking players={room.players} pileCounts={round.pileCounts} />
          {isHost ? (
            <div className="mt-1 flex flex-col gap-2.5">
              <StartButton onClick={() => send({ type: "start_round" })}>Jugar de nuevo</StartButton>
              <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
            </div>
          ) : (
            <div className={clsx(T.card, "text-center")}>
              <p className="text-sm text-[#9089c0]">Esperando que el anfitrión inicie otra partida</p>
            </div>
          )}
        </div>
      </PhaseTransition>
    );
  }

  return null;
}
