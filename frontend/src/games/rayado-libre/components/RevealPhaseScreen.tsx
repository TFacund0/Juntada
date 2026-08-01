import { S } from "../../../theme/styles";
import { Btn } from "../../../components/ui/Btn";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import { RevealedWordCard } from "./RevealedWordCard";
import { ChatMessages } from "./ChatMessages";
import { Scoreboard } from "./Scoreboard";
import { roomScore } from "../utils/roomScore";

interface RevealPhaseScreenProps {
  room: RoundViewProps["room"];
  round: RayadoLibreRoundState;
  me: RoundViewProps["me"];
  myPlayer: RoundViewProps["myPlayer"];
  send: RoundViewProps["send"];
}

/** Fase "reveal": la palabra revelada, el recap del chat, la tabla de puntos y el botón de "listo". */
export function RevealPhaseScreen({ room, round, me, myPlayer, send }: RevealPhaseScreenProps) {
  const chatLog = round.chatLog ?? [];
  const roundPoints = round.roundPoints ?? {};
  const onlinePlayers = room.players.filter(p => p.online);
  const readyCount = onlinePlayers.filter(p => p.ready).length;
  const iAmReady = !!myPlayer?.ready;
  const isLastTurn = round.turnNumber === round.totalTurns;

  return (
    <PhaseTransition phaseKey="reveal">
      <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 8 }}>
        Turno {round.turnNumber}/{round.totalTurns}
      </p>
      <RevealedWordCard word={round.word ?? ""} />

      <div style={S.card}>
        <span style={S.label}>Cómo veníamos escribiendo</span>
        <ChatMessages chatLog={chatLog} players={room.players} />
      </div>

      <Scoreboard
        entries={room.players.map(p => ({
          id: p.id,
          name: p.name,
          score: roomScore(room)[p.id] || 0,
          roundPoints: roundPoints[p.id],
          isMe: p.id === me?.playerId,
        }))}
        title={isLastTurn ? "Tabla final" : "Tabla de puntos"}
      />

      <div style={{ ...S.card, marginTop: 16 }}>
        <span style={S.label}>Estado de jugadores</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {room.players.map(p => (
            <div key={p.id} style={{ ...S.pill(p.ready), opacity: p.online ? 1 : 0.55 }}>
              {p.name}
              {!p.online ? " · desconectado" : p.ready ? " · listo" : ""}
            </div>
          ))}
        </div>
      </div>

      {!iAmReady ? (
        <Btn variant="success" onClick={() => send({ type: "player_ready" })} style={{ marginTop: 8 }}>
          {isLastTurn ? "Listo para ver los resultados" : "Listo para el siguiente turno"}
        </Btn>
      ) : (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#5DCAA5" }}>
            Listo — esperando a los demás ({readyCount}/{onlinePlayers.length})
          </p>
        </div>
      )}
    </PhaseTransition>
  );
}
