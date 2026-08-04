import { StartButton } from "../../../components/setup/StartButton";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { LocalPlayer } from "../types/localGame";
import { PodiumBoard } from "./PodiumBoard";

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
        center={<PodiumBoard entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0 }))} />}
        // Sends everyone back to the players/config screen instead of
        // restarting instantly — lets the group adjust players or settings
        // before the next match, same as the online mode's "Nueva partida".
        stickyBottom={<StartButton onClick={backToSetup}>Nueva partida</StartButton>}
      />
    </PhaseTransition>
  );
}
