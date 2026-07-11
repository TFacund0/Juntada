import { useState } from "react";
import { S } from "../../theme/styles";
import { Btn } from "../../components/Btn";
import { Avatar } from "../../components/Avatar";
import { CardView } from "./CardView";
import { getDescription } from "./deck";
import { RevealCountdown, useRevealCountdown } from "../../components/RevealCountdown";

function TurnOrder({ players, order, turnId }) {
  const ordered = order.map(id => players.find(p => p.id === id)).filter(Boolean);
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <span style={S.label}>Orden de turno</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ordered.map(p => {
          const active = p.id === turnId;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 20,
              background: active ? "rgba(93,202,165,0.15)" : "rgba(255,255,255,0.04)",
              border: active ? "1px solid #5DCAA5" : "1px solid rgba(127,119,221,0.15)",
            }}>
              <Avatar name={p.name} size={20} />
              <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? "#5DCAA5" : "#b8b0d4" }}>{p.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ranking({ players, pileCounts }) {
  const ranked = players
    .map(p => ({ ...p, count: pileCounts[p.id] || 0 }))
    .sort((a, b) => b.count - a.count);
  const maxCount = ranked[0]?.count ?? 0;
  return (
    <div style={S.card}>
      <span style={S.label}>Cartas acumuladas</span>
      {ranked.map((p, i) => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: i < ranked.length - 1 ? "1px solid rgba(127,119,221,0.08)" : "none" }}>
          <span style={{ width: 20, fontSize: 12, fontWeight: 800, color: "#6b6490" }}>{i + 1}</span>
          <Avatar name={p.name} size={28} />
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.name}{!p.online ? " (desconectado)" : ""}</span>
          {p.count === maxCount && maxCount > 0 && <span style={{ fontSize: 11, color: "#F09595", fontWeight: 700 }}>pierde</span>}
          <span style={{ fontWeight: 800, color: p.count === maxCount && maxCount > 0 ? "#F09595" : "#AFA9EC", minWidth: 24, textAlign: "right" }}>{p.count}</span>
        </div>
      ))}
    </div>
  );
}

// Ronda online: el mazo vive en el server (room.round), cada uno lo ve desde
// su propio dispositivo. Solo quien tiene el turno puede tocar el mazo y,
// una vez revelada la carta, elegir manualmente (según lo que decida el
// grupo en voz/chat) quién se la come.
export function RoundView({ room, me, isHost, send }) {
  const [showRanking, setShowRanking] = useState(false);
  const round = room.round;
  // No standalone match counter on this engine — the pile distribution is a
  // stable stand-in: it only changes once a new deck starts.
  const revealCount = useRevealCountdown(round ? JSON.stringify(round.pileCounts) : "");
  if (!round) return null;

  const turnPlayer = room.players.find(p => p.id === round.turnId);
  const myTurn = round.turnId === me.playerId;
  const descriptions = room.config.descriptions || {};

  const canSeeScore = isHost || !!room.config.showScoreToPlayers;

  if (room.phase === "round") {
    return (
      <div>
        <TurnOrder players={room.players} order={round.order || []} turnId={round.turnId} />

        {!round.current && (
          <p style={{ textAlign: "center", fontSize: 14, color: "#9089c0", marginBottom: 14 }}>
            {myTurn
              ? <>Tu turno — <strong style={{ color: "#5DCAA5" }}>tocá el mazo</strong></>
              : <>Turno de <strong>{turnPlayer?.name}</strong></>}
          </p>
        )}

        <CardView card={round.current} onClick={myTurn && !round.current ? () => send({ type: "reveal" }) : undefined} />

        <p style={{ textAlign: "center", ...S.muted, margin: "10px 0 0" }}>Quedan {round.remaining} cartas en el mazo</p>

        {round.current && (
          <div style={{ ...S.cardHighlight, marginTop: 14 }}>
            {getDescription(descriptions, round.current) && (
              <p style={{ textAlign: "center", fontSize: 13, color: "#b8b0d4", margin: "0 0 12px" }}>"{getDescription(descriptions, round.current)}"</p>
            )}
            {myTurn ? (
              <>
                <span style={{ ...S.label, textAlign: "center", display: "block" }}>¿Quién se la queda?</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                  {room.players.map(p => (
                    <button key={p.id} onClick={() => send({ type: "assign", targetId: p.id })} style={{ ...S.btn("secondary"), display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-start", padding: "10px 14px" }}>
                      <Avatar name={p.name} size={26} />
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p style={{ textAlign: "center", ...S.muted }}>Esperando que {turnPlayer?.name} reparta la carta</p>
            )}
          </div>
        )}

        {canSeeScore ? (
          <>
            <button onClick={() => setShowRanking(v => !v)} style={{ ...S.btn("secondary"), width: "100%", fontSize: 13, marginTop: 14 }}>
              {showRanking ? "Ocultar puntaje" : "Ver puntaje"}
            </button>
            {showRanking && <div style={{ marginTop: 14 }}><Ranking players={room.players} pileCounts={round.pileCounts} /></div>}
          </>
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginTop: 14 }}>El puntaje se revela al final de la partida</p>
        )}

        <div style={{ ...S.card, marginTop: 14 }}>
          <span style={S.label}>Terminar antes ({(round.endVotes || []).length}/{round.endVoteThreshold})</span>
          <p style={{ ...S.muted, marginTop: -6, marginBottom: 10 }}>Con la mitad de los jugadores votando, se corta la partida y se muestra la tabla como está ahora.</p>
          {(round.endVotes || []).includes(me.playerId) ? (
            <p style={{ ...S.muted }}>Votaste terminar — esperando al resto</p>
          ) : (
            <Btn variant="danger" onClick={() => send({ type: "vote_end" })}>Votar para terminar</Btn>
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
            <p style={{ ...S.muted, marginTop: 8 }}>Se votó terminar justo cuando se estaba por decidir quién se la quedaba, así que no se le sumó a nadie.</p>
          </div>
        )}
        <Ranking players={room.players} pileCounts={round.pileCounts} />
        {isHost ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <Btn variant="success" onClick={() => send({ type: "start_round" })}>Jugar de nuevo</Btn>
            <Btn variant="secondary" onClick={() => send({ type: "back_to_lobby" })}>Volver al lobby</Btn>
          </div>
        ) : (
          <div style={{ ...S.card, textAlign: "center" }}><p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra partida</p></div>
        )}
      </div>
    );
  }

  return null;
}
