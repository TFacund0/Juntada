import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { LocalPlayer } from "../types/localGame";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { TurnHeader } from "./TurnHeader";
import { PassDeviceCard } from "./PassDeviceCard";
import { ChooseWordPanel } from "./choose/ChooseWordPanel";

interface WordRevealScreenProps {
  turnNumber: number;
  totalTurns: number;
  drawer: LocalPlayer | undefined;
  choicesRevealed: boolean;
  revealChoices: () => void;
  wordChoices: string[];
  chooseWord: (word: string) => void;
  sfx: RayadoSfx;
}

/**
 * Pantalla "wordReveal" del modo local: el dispositivo recién pasó de mano y
 * quien dibuja elige palabra en privado, con el mismo abanico que online —
 * sin "Se elige sola": en local no hay servidor que elija por nadie.
 */
export function WordRevealScreen({
  turnNumber,
  totalTurns,
  drawer,
  choicesRevealed,
  revealChoices,
  wordChoices,
  chooseWord,
  sfx,
}: WordRevealScreenProps) {
  return (
    <GameScreenLayout
      top={<TurnHeader turnNumber={turnNumber} totalTurns={totalTurns} />}
      center={
        !choicesRevealed ? (
          <PassDeviceCard drawerName={drawer?.name ?? "?"} onReady={revealChoices} />
        ) : (
          <ChooseWordPanel words={wordChoices} onChoose={chooseWord} sfx={sfx} />
        )
      }
    />
  );
}
