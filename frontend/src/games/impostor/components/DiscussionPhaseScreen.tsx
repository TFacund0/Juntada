import { S } from "../../../theme/styles";
import { Btn } from "../../../components/Btn";
import { Timer } from "../../../components/Timer";
import { PhaseTransition } from "../../../components/PhaseTransition";
import { CluesReview } from "./CluesReview";
import type { RoundViewProps } from "../../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";
import type { ImpostorRoundState, ImpostorConfigState } from "../types/roundView";

function PlayerReadyPills({ players }: { players: PublicPlayer[] }) {
  return (
    <div style={{ ...S.card, marginTop: 16 }}>
      <span style={S.label}>Estado de jugadores</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {players.map(p => (
          <div key={p.id} style={{ ...S.pill(p.ready), opacity: p.online ? 1 : 0.55 }}>
            {p.name}
            {!p.online ? " · desconectado" : p.ready ? " · listo" : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DiscussionPhaseScreenProps {
  room: RoundViewProps["room"];
  myPlayer: RoundViewProps["myPlayer"];
  send: RoundViewProps["send"];
  round: ImpostorRoundState | null;
  config: ImpostorConfigState;
}

// The discussion phase: an optional server-driven timer, a review of
// everyone's clues, and a "Listo para votar" ready-check before the room
// advances to voting.
export function DiscussionPhaseScreen({ room, myPlayer, send, round, config }: DiscussionPhaseScreenProps) {
  const myReadyState = myPlayer?.ready;
  return (
    <PhaseTransition phaseKey="discussion">
      <div>
        {round?.discussionEnd && <Timer timerEnd={round.discussionEnd} total={config.discussionTime} label="Tiempo de discusión" />}

        <CluesReview clues={round?.clues} players={room.players} />

        <PlayerReadyPills players={room.players} />

        {!myReadyState && (
          <Btn variant="success" onClick={() => send({ type: "player_ready" })} style={{ marginTop: 8 }}>
            Listo para votar
          </Btn>
        )}
        {myReadyState && (
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ color: "#5DCAA5" }}>Listo — esperando a los demás para pasar a la votación</p>
          </div>
        )}
      </div>
    </PhaseTransition>
  );
}
