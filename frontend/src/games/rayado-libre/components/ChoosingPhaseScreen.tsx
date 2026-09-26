import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { CENTERED_BLOCK, FULL_HEIGHT_SCREEN } from "../utils/screenLayout";
import { TurnHeader } from "./TurnHeader";
import { WaitingForWordCard } from "./WaitingForWordCard";
import { ChooseWordPanel } from "./choose/ChooseWordPanel";

const CHOOSE_SECONDS = 15;

interface ChoosingPhaseScreenProps {
  round: RayadoLibreRoundState;
  isDrawer: boolean;
  wordChoices: string[] | null;
  drawerPlayer: RoundViewProps["room"]["players"][number] | undefined;
  drawerOffline: boolean;
  sfx: RayadoSfx;
  send: RoundViewProps["send"];
}

/** Fase "choosing": quien dibuja elige entre 3 palabras mientras el resto espera — centrado en vertical en todo el alto disponible. */
export function ChoosingPhaseScreen({ round, isDrawer, wordChoices, drawerPlayer, drawerOffline, sfx, send }: ChoosingPhaseScreenProps) {
  return (
    <GameScreenLayout
      className={FULL_HEIGHT_SCREEN}
      top={
        <>
          <TurnHeader turnNumber={round.turnNumber} totalTurns={round.totalTurns} />
          {drawerOffline && (
            <p className="mb-2 text-center text-xs text-rl-warn">
              ⚠️ {drawerPlayer?.name} se desconectó — se elige una palabra sola si no vuelve a tiempo
            </p>
          )}
        </>
      }
      center={
        <div className={CENTERED_BLOCK}>
          {isDrawer ? (
            // La cuenta regresiva va en el texto de abajo del abanico, como en la referencia.
            <ChooseWordPanel
              words={wordChoices ?? []}
              onChoose={w => send({ type: "choose_word", word: w })}
              sfx={sfx}
              autoPickAt={round.chooseTimerEnd}
              autoPickTotal={CHOOSE_SECONDS}
            />
          ) : (
            <WaitingForWordCard
              drawerName={drawerPlayer?.name ?? "?"}
              timerEnd={round.chooseTimerEnd ?? undefined}
              total={CHOOSE_SECONDS}
            />
          )}
        </div>
      }
    />
  );
}
