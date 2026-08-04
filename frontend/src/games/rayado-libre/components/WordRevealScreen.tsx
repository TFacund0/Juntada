import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { LocalPlayer } from "../types/localGame";
import { TurnHeader } from "./TurnHeader";
import { WordChoiceFan } from "./WordChoiceFan";
import { PassDeviceCard } from "./PassDeviceCard";

interface WordRevealScreenProps {
  turnNumber: number;
  totalTurns: number;
  drawer: LocalPlayer | undefined;
  choicesRevealed: boolean;
  revealChoices: () => void;
  wordChoices: string[];
  chooseWord: (word: string) => void;
}

/** Pantalla "wordReveal" del modo local: el dispositivo recién pasó de mano y quien dibuja elige palabra en privado. */
export function WordRevealScreen({
  turnNumber,
  totalTurns,
  drawer,
  choicesRevealed,
  revealChoices,
  wordChoices,
  chooseWord,
}: WordRevealScreenProps) {
  return (
    <PhaseTransition phaseKey="wordReveal">
      <GameScreenLayout
        top={<TurnHeader turnNumber={turnNumber} totalTurns={totalTurns} />}
        center={
          !choicesRevealed ? (
            <PassDeviceCard drawerName={drawer?.name ?? "?"} onReady={revealChoices} />
          ) : (
            <WordChoiceFan words={wordChoices} onChoose={chooseWord} />
          )
        }
      />
    </PhaseTransition>
  );
}
