import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { LocalPlayer } from "../types/localGame";
import { CENTERED_BLOCK, FULL_HEIGHT_SCREEN } from "../utils/screenLayout";
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
}

/**
 * Pantalla "wordReveal" del modo local: el dispositivo recién pasó de mano y
 * quien dibuja elige palabra en privado, con el mismo abanico que online —
 * sin "Se elige sola": en local no hay servidor que elija por nadie. Ocupa
 * todo el alto disponible y centra el bloque en vertical.
 */
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
    <GameScreenLayout
      className={FULL_HEIGHT_SCREEN}
      top={<TurnHeader turnNumber={turnNumber} totalTurns={totalTurns} />}
      center={
        !choicesRevealed ? (
          <PassDeviceCard drawerName={drawer?.name ?? "?"} onReady={revealChoices} />
        ) : (
          <div className={CENTERED_BLOCK}>
            <ChooseWordPanel words={wordChoices} onChoose={chooseWord} />
          </div>
        )
      }
    />
  );
}
