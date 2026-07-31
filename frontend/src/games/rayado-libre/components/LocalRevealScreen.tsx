import { StartButton } from "../../../components/setup/StartButton";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import type { LocalPlayer } from "../types/localGame";
import { RevealedWordCard } from "./RevealedWordCard";
import { Scoreboard } from "./Scoreboard";

interface LocalRevealScreenProps {
  word: string | null;
  players: LocalPlayer[];
  scores: Record<number, number>;
  roundPoints: Record<number, number>;
  isLastTurn: boolean;
  goToNextTurn: () => void;
}

/** Pantalla "reveal" del modo local: la palabra, la tabla de la ronda, y el pase al siguiente turno. */
export function LocalRevealScreen({ word, players, scores, roundPoints, isLastTurn, goToNextTurn }: LocalRevealScreenProps) {
  return (
    <PhaseTransition phaseKey="reveal">
      <div>
        <RevealedWordCard word={word ?? ""} />

        <Scoreboard
          entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0, roundPoints: roundPoints[p.id] }))}
          title={isLastTurn ? "Tabla final" : "Tabla de puntos"}
        />

        <StartButton onClick={goToNextTurn}>{isLastTurn ? "Ver la tabla final" : "Siguiente turno"}</StartButton>
      </div>
    </PhaseTransition>
  );
}
