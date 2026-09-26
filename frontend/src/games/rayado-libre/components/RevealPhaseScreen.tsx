import { useMemo } from "react";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import { roomScore } from "../utils/roomScore";
import { buildTurnScoreRows } from "../utils/turnScores";
import { ChatRecap } from "./chat/ChatRecap";
import { RevealView } from "./reveal/RevealView";
import { PrimaryButton, PrimaryNote } from "./PrimaryButton";

interface RevealPhaseScreenProps {
  room: RoundViewProps["room"];
  round: RayadoLibreRoundState;
  me: RoundViewProps["me"];
  myPlayer: RoundViewProps["myPlayer"];
  /** Mis intentos "cerca" (vista privada) — el recap los sigue marcando solo para mí. */
  closeEntryIds: readonly number[];
  send: RoundViewProps["send"];
}

const NO_POINTS: Record<string, number> = {};

/**
 * Fase "reveal" online: la palabra, la tabla del turno y el chat completo
 * del turno debajo. El botón de la referencia ("Siguiente turno" / "Ver
 * podio") acá marca "listo": el turno avanza cuando todos los conectados lo
 * tocaron, y mientras tanto dice cuántos faltan.
 */
export function RevealPhaseScreen({ room, round, me, myPlayer, closeEntryIds, send }: RevealPhaseScreenProps) {
  const roundPoints = round.roundPoints ?? NO_POINTS;
  const onlinePlayers = room.players.filter(p => p.online);
  const readyCount = onlinePlayers.filter(p => p.ready).length;
  const isLastTurn = round.turnNumber === round.totalTurns;
  const myId = me?.playerId;
  const rows = useMemo(
    () =>
      buildTurnScoreRows({
        players: room.players,
        drawerId: round.drawerId,
        roundPoints,
        guessSeconds: round.guessSeconds,
        totals: roomScore(room),
        myId,
      }),
    [room, round.drawerId, roundPoints, round.guessSeconds, myId],
  );

  return (
    <RevealView
      word={round.word ?? ""}
      rows={rows}
      foot={
        myPlayer?.ready ? (
          <PrimaryNote>{`Listo — esperando a los demás (${readyCount}/${onlinePlayers.length})`}</PrimaryNote>
        ) : (
          <PrimaryButton onClick={() => send({ type: "player_ready" })}>{isLastTurn ? "Ver podio" : "Siguiente turno"}</PrimaryButton>
        )
      }
    >
      <ChatRecap
        players={room.players}
        myId={myId}
        drawerId={round.drawerId}
        chatLog={round.chatLog ?? []}
        correctGuessers={round.correctGuessers ?? []}
        roundPoints={roundPoints}
        closeEntryIds={closeEntryIds}
      />
    </RevealView>
  );
}
