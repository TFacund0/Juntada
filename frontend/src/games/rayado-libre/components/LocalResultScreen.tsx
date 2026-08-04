import { StartButton } from "../../../components/setup/StartButton";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import { PodiumBoard } from "../../../components/game-kit/PodiumBoard";
import type { LocalPlayer } from "../types/localGame";
import { RAYADO_RAINBOW } from "../rainbow";

// 1° naranja, 2° azul, 3° violeta (índices 1/3/4 del anillo) — para que el
// cierre de partida se sienta parte de la misma paleta en vez del oro/
// plata/bronce genérico que trae PodiumBoard por defecto.
const PODIUM_COLORS: [string, string, string] = [RAYADO_RAINBOW[1], RAYADO_RAINBOW[3], RAYADO_RAINBOW[4]];

interface LocalResultScreenProps {
  players: LocalPlayer[];
  scores: Record<number, number>;
  backToSetup: () => void;
}

/** Pantalla "result" del modo local: podio final de toda la partida, con "Nueva partida" fijo abajo — mismo tratamiento que `ResultPhaseScreen` online. */
export function LocalResultScreen({ players, scores, backToSetup }: LocalResultScreenProps) {
  return (
    <PhaseTransition phaseKey="result">
      <GameScreenLayout
        top={<p style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "8px 0 16px" }}>Fin del juego</p>}
        center={<PodiumBoard entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0 }))} colors={PODIUM_COLORS} />}
        // Sends everyone back to the players/config screen instead of
        // restarting instantly — lets the group adjust players or settings
        // before the next match, same as the online mode's "Nueva partida".
        stickyBottom={<StartButton onClick={backToSetup}>Nueva partida</StartButton>}
      />
    </PhaseTransition>
  );
}
