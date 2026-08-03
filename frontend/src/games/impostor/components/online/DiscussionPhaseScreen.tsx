import type { CSSProperties } from "react";
import { S } from "../../../../theme/styles";
import { Btn } from "../../../../components/ui/Btn";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../../../components/setup/StickyActionBar";
import { PhaseTransition } from "../../../../components/game-kit/PhaseTransition";
import { RingTimerLive } from "../shared/RingTimer";
import { DiscussionChat } from "./DiscussionChat";
import { CluesReview } from "../shared/CluesReview";
import { staggerPopStyle } from "../shared/staggerPopStyle";
import { actionBtnStyle } from "../shared/actionBtnStyle";
import type { RoundViewProps } from "../../../gameTypes";
import type { PublicPlayer } from "@juntada/shared-types";
import type { ImpostorRoundState, ImpostorConfigState } from "../../types/roundView";

function PlayerReadyPills({ players }: { players: PublicPlayer[] }) {
  return (
    <div style={{ ...S.card, marginTop: 16 }}>
      <style>{staggerPopStyle}</style>
      <span style={S.label}>Estado de jugadores</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {players.map(p => (
          // Keyed by ready+online too — a status flip remounts the pill so
          // it replays the pop instead of just silently swapping colors,
          // same "something just changed" cue as everywhere else that uses
          // impostor-stagger-pop.
          <div
            key={`${p.id}-${p.ready}-${p.online}`}
            className="impostor-stagger-pop"
            style={{ ...S.pill(p.ready), opacity: p.online ? 1 : 0.55 }}
          >
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
      <div style={{ paddingBottom: STICKY_ACTION_BAR_CLEARANCE }}>
        <style>{actionBtnStyle}</style>

        {!config.discussionUnlimited ? (
          round?.discussionEnd && <RingTimerLive timerEnd={round.discussionEnd} total={config.discussionTime} label="Tiempo de discusión" />
        ) : (
          <p style={{ ...S.muted, textAlign: "center", marginBottom: 16 }}>Sin límite de tiempo — discutan a su ritmo.</p>
        )}

        <CluesReview clues={round?.clues} players={room.players} />

        {config.discussionMode === "chat" && <DiscussionChat chat={round?.chat ?? []} myPlayerId={myPlayer?.id} send={send} />}

        <PlayerReadyPills players={room.players} />

        <StickyActionBar>
          {!myReadyState ? (
            <Btn
              variant="success"
              onClick={() => send({ type: "player_ready" })}
              className="impostor-action-btn"
              style={{ "--impostor-action-glow": "rgba(93,202,165,0.3)" } as CSSProperties}
            >
              Listo para votar
            </Btn>
          ) : (
            <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
              <p style={{ color: "#5DCAA5" }}>Listo — esperando a los demás para pasar a la votación</p>
            </div>
          )}
        </StickyActionBar>
      </div>
    </PhaseTransition>
  );
}
