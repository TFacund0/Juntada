import { useEffect, useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { StartButton } from "../../components/StartButton";
import { LeaveToLobbyButton } from "../../components/LeaveToLobbyButton";
import { Avatar } from "../../components/Avatar";
import { CardView, DeckStack } from "./CardView";
import { AssignPicker } from "./AssignPicker";
import { DescriptionToggle } from "./DescriptionToggle";
import { ScoreToggleButton } from "./ScoreToggleButton";
import { cardKey, getDescription } from "./deck";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";
import type { RoundViewProps } from "../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";

function TurnOrder({ players, order, turnId }: { players: PublicPlayer[]; order: string[]; turnId: string }) {
  const ordered = order.map(id => players.find(p => p.id === id)).filter((p): p is PublicPlayer => Boolean(p));
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <span style={S.label}>Orden de turno</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ordered.map(p => {
          const active = p.id === turnId;
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px 4px 4px",
                borderRadius: 20,
                background: active ? "rgba(93,202,165,0.15)" : "rgba(255,255,255,0.04)",
                border: active ? "1px solid #5DCAA5" : "1px solid rgba(127,119,221,0.15)",
              }}
            >
              <Avatar name={p.name} size={20} />
              <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? "#5DCAA5" : "#b8b0d4" }}>{p.name}</span>
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
    <div style={S.card}>
      <span style={S.label}>Cartas acumuladas</span>
      {ranked.map((p, i) => (
        <div
          key={p.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 0",
            borderBottom: i < ranked.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none",
          }}
        >
          <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
            {p.name}
            {!p.online ? " (desconectado)" : ""}
          </span>
          {p.count === maxCount && maxCount > 0 && <span style={{ fontSize: 11, color: "#F09595", fontWeight: 700 }}>pierde</span>}
          <span
            style={{
              fontWeight: 800,
              color: p.count === maxCount && maxCount > 0 ? "#F09595" : "#AFA9EC",
              minWidth: 24,
              textAlign: "right",
            }}
          >
            {p.count}
          </span>
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
  const round = room.round as any;
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

        <div style={{ position: "relative", width: 140, height: 196, margin: "0 auto", zIndex: 0 }}>
          <DeckStack cardsLeft={round.remaining} />
          <div style={{ position: "relative" }}>
            <CardView card={round.current} onClick={myTurn && !round.current ? () => send({ type: "reveal" }) : undefined} />
          </div>
        </div>

        <p style={{ textAlign: "center", ...S.muted, margin: "10px 0 0" }}>Quedan {round.remaining} cartas en el mazo</p>

        {round.current && (
          <div style={{ marginTop: 14 }}>
            <DescriptionToggle
              key={cardKey(round.current.suit, round.current.value)}
              description={getDescription(descriptions, round.current)}
            />
          </div>
        )}

        {round.current && (
          <div style={{ ...S.cardHighlight, marginTop: 14 }}>
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
              <p style={{ textAlign: "center", ...S.muted }}>Esperando que {turnPlayer?.name} reparta la carta</p>
            )}
          </div>
        )}

        <ScoreToggleButton show={showRanking} onToggle={() => setShowRanking(v => !v)} />
        {showRanking && <Ranking players={room.players} pileCounts={round.pileCounts} />}

        {/* Chico a propósito — terminar antes es la excepción, no algo a lo
            que se quiera empujar al grupo — pero en rojo como el resto de
            los "terminar partida" del modo local, ya que corta el juego. */}
        <div style={{ textAlign: "center", marginTop: 18 }}>
          <button
            onClick={() => setShowEndVote(v => !v)}
            style={{ ...S.btn("danger"), width: "auto", padding: "6px 14px", fontSize: 12 }}
          >
            {(round.endVotes || []).length > 0
              ? `Terminar antes (${round.endVotes.length}/${round.endVoteThreshold})`
              : "Terminar antes"}
          </button>
          {showEndVote && (
            <div style={{ ...S.card, marginTop: 10, textAlign: "left" }}>
              <p style={{ ...S.muted, marginBottom: 10 }}>
                Con la mitad de los jugadores votando, se corta la partida y se muestra la tabla como está ahora.
                {round.current && " La carta que está revelada ahora mismo quedaría sin repartir, sin sumarle a nadie."}
              </p>
              {me && (round.endVotes || []).includes(me.playerId) ? (
                <p style={{ ...S.muted, margin: 0 }}>Votaste terminar — esperando al resto</p>
              ) : (
                <Btn variant="ghost" onClick={() => send({ type: "vote_end" })}>
                  Votar para terminar
                </Btn>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (room.phase === "result") {
    if (revealCount > 0) return <RevealCountdown count={revealCount} label="Revelando la tabla final..." />;
    return (
      <div>
        <div style={{ ...S.cardHighlight, textAlign: "center" }}>
          <p style={S.bigReveal}>{round.remaining > 0 ? "Partida terminada por votación" : "Se acabó el mazo"}</p>
        </div>
        {round.current && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <span style={S.label}>Quedó sin repartir</span>
            <CardView card={round.current} size="small" />
            <p style={{ ...S.muted, marginTop: 8 }}>
              Se votó terminar justo cuando se estaba por decidir quién se la quedaba, así que no se le sumó a nadie.
            </p>
          </div>
        )}
        <Ranking players={room.players} pileCounts={round.pileCounts} />
        {isHost ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <StartButton onClick={() => send({ type: "start_round" })}>Jugar de nuevo</StartButton>
            <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
          </div>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra partida</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
