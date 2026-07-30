import { StartButton } from "../../../components/StartButton";
import { PhaseTransition } from "../../../components/PhaseTransition";
import type { LocalPlayer } from "../types/localGame";
import { Scoreboard } from "./Scoreboard";

interface LocalResultScreenProps {
  players: LocalPlayer[];
  scores: Record<number, number>;
  backToSetup: () => void;
}

/** Pantalla "result" del modo local: tabla final de toda la partida. */
export function LocalResultScreen({ players, scores, backToSetup }: LocalResultScreenProps) {
  return (
    <PhaseTransition phaseKey="result">
      <p style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#AFA9EC", margin: "8px 0 16px" }}>Fin del juego</p>
      <Scoreboard entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0 }))} title="Tabla final" />
      {/* Sends everyone back to the players/config screen instead of
          restarting instantly — lets the group adjust players or settings
          before the next match, same as the online mode's "Nueva partida". */}
      <StartButton onClick={backToSetup}>Jugar de nuevo</StartButton>
    </PhaseTransition>
  );
}
