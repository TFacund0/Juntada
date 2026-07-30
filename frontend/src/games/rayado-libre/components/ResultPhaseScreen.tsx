import { S } from "../../../theme/styles";
import { StartButton } from "../../../components/StartButton";
import { PhaseTransition } from "../../../components/PhaseTransition";
import { LeaveToLobbyButton } from "../../../components/LeaveToLobbyButton";
import type { RoundViewProps } from "../../gameTypes";
import { Scoreboard } from "./Scoreboard";
import { roomScore } from "../utils/roomScore";

interface ResultPhaseScreenProps {
  room: RoundViewProps["room"];
  me: RoundViewProps["me"];
  isHost: boolean;
  send: RoundViewProps["send"];
}

/** Fase "result": la tabla final de toda la partida online. */
export function ResultPhaseScreen({ room, me, isHost, send }: ResultPhaseScreenProps) {
  return (
    <PhaseTransition phaseKey="result">
      <p style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "8px 0 16px" }}>Fin del juego</p>
      <Scoreboard
        entries={room.players.map(p => ({ id: p.id, name: p.name, score: roomScore(room)[p.id] || 0, isMe: p.id === me?.playerId }))}
        title="Tabla final"
      />
      {isHost ? (
        <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
      ) : (
        <div style={{ ...S.card, textAlign: "center" }}>
          <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra partida</p>
        </div>
      )}
      <LeaveToLobbyButton groupCode={room.groupCode} send={send} />
    </PhaseTransition>
  );
}
