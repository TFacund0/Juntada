import { S } from "../../../theme/styles";
import { StartButton } from "../../../components/setup/StartButton";
import { StickyActionBar, STICKY_ACTION_BAR_CLEARANCE } from "../../../components/setup/StickyActionBar";
import { PodiumBoard } from "../../../components/game-kit/PodiumBoard";
import type { RoundViewProps } from "../../gameTypes";
import type { RoomPublicState } from "@juntada/shared-types";
import type { TutifrutiRoundState } from "../types/roundView";

// Colores fijos de confetti (no leen el tema — el contraste con el fondo
// importa más acá que combinar con el acento del juego).
const CONFETTI_COLORS = ["#c94bd6", "#5b5ce0", "#5DCAA5", "#E2C44A", "#2e8bff"];

export function FinalStandings({
  room,
  isHost,
  send,
}: {
  room: RoomPublicState;
  round: TutifrutiRoundState;
  isHost: boolean;
  send: RoundViewProps["send"];
}) {
  const score = room.config.score as Record<string, number>;
  const standings = [...room.players].map(p => ({ ...p, score: score[p.id] || 0 })).sort((a, b) => b.score - a.score);

  return (
    <div style={{ paddingBottom: isHost ? STICKY_ACTION_BAR_CLEARANCE : undefined }}>
      <div style={{ textAlign: "center", padding: "12px 0" }} className="tf-confetti-wrap">
        <p style={{ ...S.title, fontSize: 26, display: "block" }}>
          <span aria-hidden="true">🏆 </span>Fin del juego
        </p>
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="tf-confetti"
            style={{
              left: `${(i * 100) / 16 + (i % 2 === 0 ? 2 : -2)}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDuration: `${1.8 + (i % 5) * 0.3}s`,
              animationDelay: `${(i % 7) * 0.15}s`,
            }}
          />
        ))}
      </div>
      <PodiumBoard entries={standings} />
      {!isHost && <p style={{ ...S.muted, textAlign: "center" }}>Esperando a que el anfitrión arranque una partida nueva.</p>}
      {isHost && (
        <StickyActionBar>
          <StartButton className="jt-btn-anim tf-startbtn-pulse" onClick={() => send({ type: "new_game" })}>
            Nueva partida
          </StartButton>
        </StickyActionBar>
      )}
    </div>
  );
}
