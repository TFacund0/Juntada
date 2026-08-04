import { StartButton } from "../../../components/setup/StartButton";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { LocalPlayer } from "../types/localGame";
import { RevealedWordCard } from "./RevealedWordCard";
import { RoundScoreboard } from "./RoundScoreboard";

interface LocalRevealScreenProps {
  word: string | null;
  players: LocalPlayer[];
  scores: Record<number, number>;
  roundPoints: Record<number, number>;
  isLastTurn: boolean;
  goToNextTurn: () => void;
}

/** Pantalla "reveal" del modo local: la palabra, la tabla de la ronda, y el pase al siguiente turno — con el botón de avance fijo abajo, igual que la fase equivalente online (`RevealPhaseScreen`). */
export function LocalRevealScreen({ word, players, scores, roundPoints, isLastTurn, goToNextTurn }: LocalRevealScreenProps) {
  return (
    <PhaseTransition phaseKey="reveal">
      <GameScreenLayout
        center={
          <>
            <RevealedWordCard word={word ?? ""} />
            <RoundScoreboard
              entries={players.map(p => ({ id: p.id, name: p.name, score: scores[p.id] || 0, roundPoints: roundPoints[p.id] }))}
              title={isLastTurn ? "Tabla final" : "Tabla de puntos"}
            />
          </>
        }
        stickyBottom={<StartButton onClick={goToNextTurn}>{isLastTurn ? "Ver la tabla final" : "Siguiente turno"}</StartButton>}
      />
    </PhaseTransition>
  );
}
