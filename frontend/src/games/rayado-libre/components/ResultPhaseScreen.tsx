import { useMemo } from "react";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { roomScore } from "../utils/roomScore";
import { RayadoPodium } from "./podium/RayadoPodium";
import { PrimaryButton, PrimaryNote } from "./PrimaryButton";

interface ResultPhaseScreenProps {
  room: RoundViewProps["room"];
  me: RoundViewProps["me"];
  isHost: boolean;
  sfx: RayadoSfx;
  send: RoundViewProps["send"];
}

/** Fase "result" online: el podio de toda la partida; "Jugar de nuevo" lo tiene solo el anfitrión. */
export function ResultPhaseScreen({ room, me, isHost, sfx, send }: ResultPhaseScreenProps) {
  const entries = useMemo(() => {
    const score = roomScore(room);
    return room.players.map(p => ({ id: p.id, name: p.name, score: score[p.id] || 0, isMe: p.id === me?.playerId }));
  }, [room, me?.playerId]);

  return (
    <RayadoPodium
      entries={entries}
      sfx={sfx}
      foot={
        isHost ? (
          <PrimaryButton onClick={() => send({ type: "new_game" })}>Jugar de nuevo</PrimaryButton>
        ) : (
          <PrimaryNote>Esperando que el anfitrión inicie otra partida</PrimaryNote>
        )
      }
    />
  );
}
