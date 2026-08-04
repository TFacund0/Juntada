import { S } from "../../../theme/styles";
import { StartButton } from "../../../components/setup/StartButton";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import { PodiumBoard } from "../../../components/game-kit/PodiumBoard";
import type { RoundViewProps } from "../../gameTypes";
import { roomScore } from "../utils/roomScore";
import { RAYADO_RAINBOW } from "../rainbow";

// Mismo criterio que LocalResultScreen — naranja/azul/violeta del anillo en
// vez del oro/plata/bronce genérico que trae PodiumBoard por defecto.
const PODIUM_COLORS: [string, string, string] = [RAYADO_RAINBOW[1], RAYADO_RAINBOW[3], RAYADO_RAINBOW[4]];

interface ResultPhaseScreenProps {
  room: RoundViewProps["room"];
  me: RoundViewProps["me"];
  isHost: boolean;
  send: RoundViewProps["send"];
}

/**
 * Fase "result": la tabla final de toda la partida online. El podio queda
 * centrado en el espacio disponible (y más grande en desktop, donde sobra
 * ancho); "Nueva partida" queda fija al fondo de la pantalla en vez de al
 * final del scroll.
 */
export function ResultPhaseScreen({ room, me, isHost, send }: ResultPhaseScreenProps) {
  return (
    <PhaseTransition phaseKey="result">
      <style>{`
        .rl-result-center { display: flex; flex-direction: column; align-items: center; flex: 1 1 auto; }
        @media (min-width: 1024px) {
          .rl-result-center { justify-content: center; }
        }
      `}</style>
      <GameScreenLayout
        top={<p style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "8px 0 16px" }}>Fin del juego</p>}
        center={
          <div className="rl-result-center">
            <PodiumBoard
              entries={room.players.map(p => ({
                id: p.id,
                name: p.name,
                score: roomScore(room)[p.id] || 0,
                isMe: p.id === me?.playerId,
              }))}
              colors={PODIUM_COLORS}
            />
          </div>
        }
        style={{ flex: "1 1 auto" }}
        stickyBottom={
          isHost ? (
            <StartButton onClick={() => send({ type: "new_game" })}>Nueva partida</StartButton>
          ) : (
            <div style={{ ...S.card, textAlign: "center", marginBottom: 0 }}>
              <p style={{ color: "#9089c0", fontSize: 14 }}>Esperando que el anfitrión inicie otra partida</p>
            </div>
          )
        }
      />
    </PhaseTransition>
  );
}
