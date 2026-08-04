import { S } from "../../../theme/styles";
import { Btn } from "../../../components/ui/Btn";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import { RevealedWordCard } from "./RevealedWordCard";
import { GuessChatPanel } from "./GuessChatPanel";
import { RoundScoreboard } from "./RoundScoreboard";
import { TurnHeader } from "./TurnHeader";
import { roomScore } from "../utils/roomScore";

interface RevealPhaseScreenProps {
  room: RoundViewProps["room"];
  round: RayadoLibreRoundState;
  me: RoundViewProps["me"];
  myPlayer: RoundViewProps["myPlayer"];
  send: RoundViewProps["send"];
}

/**
 * Fase "reveal": palabra + tabla de puntos (con un círculo de "listo" por
 * jugador en la propia fila), el chat completo de la ronda abajo, y el botón
 * de "listo" fijo al fondo — el chat scrollea por debajo suyo (mismo patrón
 * de `StickyActionBar` que discussion/impostor).
 */
export function RevealPhaseScreen({ room, round, me, myPlayer, send }: RevealPhaseScreenProps) {
  const chatLog = round.chatLog ?? [];
  const roundPoints = round.roundPoints ?? {};
  const onlinePlayers = room.players.filter(p => p.online);
  const readyCount = onlinePlayers.filter(p => p.ready).length;
  const iAmReady = !!myPlayer?.ready;
  const isLastTurn = round.turnNumber === round.totalTurns;

  return (
    <PhaseTransition phaseKey="reveal">
      <GameScreenLayout
        top={<TurnHeader turnNumber={round.turnNumber} totalTurns={round.totalTurns} />}
        center={
          <>
            <RevealedWordCard word={round.word ?? ""} />
            <RoundScoreboard
              entries={room.players.map(p => ({
                id: p.id,
                name: p.name,
                score: roomScore(room)[p.id] || 0,
                roundPoints: roundPoints[p.id],
                isMe: p.id === me?.playerId,
                ready: p.ready,
              }))}
              title={isLastTurn ? "Tabla final" : "Tabla de puntos"}
            />
          </>
        }
        bottom={
          <GuessChatPanel
            chatLog={chatLog}
            players={room.players}
            correctGuessers={round.correctGuessers ?? []}
            roundPoints={roundPoints}
            variant="recap"
          />
        }
        stickyBottom={
          !iAmReady ? (
            <Btn variant="success" onClick={() => send({ type: "player_ready" })}>
              {isLastTurn ? "Listo para ver los resultados" : "Listo para el siguiente turno"}
            </Btn>
          ) : (
            <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
              <p style={{ color: "#5DCAA5" }}>
                Listo — esperando a los demás ({readyCount}/{onlinePlayers.length})
              </p>
            </div>
          )
        }
      />
    </PhaseTransition>
  );
}
