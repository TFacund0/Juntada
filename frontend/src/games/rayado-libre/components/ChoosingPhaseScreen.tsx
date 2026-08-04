import { Timer } from "../../../components/game-kit/Timer";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { GameScreenLayout } from "../../../components/game-kit/GameScreenLayout";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";
import { TurnHeader } from "./TurnHeader";
import { WaitingForWordCard } from "./WaitingForWordCard";
import { WordChoiceFan } from "./WordChoiceFan";

const CHOOSE_SECONDS = 15;

interface ChoosingPhaseScreenProps {
  round: RayadoLibreRoundState;
  isDrawer: boolean;
  wordChoices: string[] | null;
  drawerPlayer: RoundViewProps["room"]["players"][number] | undefined;
  drawerOffline: boolean;
  send: RoundViewProps["send"];
}

/** Fase "choosing": quien dibuja elige entre 3 palabras mientras el resto espera. */
export function ChoosingPhaseScreen({ round, isDrawer, wordChoices, drawerPlayer, drawerOffline, send }: ChoosingPhaseScreenProps) {
  return (
    <PhaseTransition phaseKey="choosing">
      <GameScreenLayout
        top={
          <>
            <TurnHeader turnNumber={round.turnNumber} totalTurns={round.totalTurns} />
            {/* Solo para quien dibuja — quien espera ve la cuenta regresiva
                en el propio anillo alrededor del avatar (WaitingForWordCard),
                no hace falta repetirla acá arriba. */}
            {isDrawer && round.chooseTimerEnd && (
              <Timer timerEnd={round.chooseTimerEnd} total={CHOOSE_SECONDS} label="Tiempo para elegir palabra" />
            )}
            {drawerOffline && (
              <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
                ⚠️ {drawerPlayer?.name} se desconectó — se elige una palabra sola si no vuelve a tiempo
              </p>
            )}
          </>
        }
        center={
          isDrawer ? (
            <WordChoiceFan words={wordChoices ?? []} onChoose={w => send({ type: "choose_word", word: w })} />
          ) : (
            <WaitingForWordCard
              drawerName={drawerPlayer?.name ?? "?"}
              timerEnd={round.chooseTimerEnd ?? undefined}
              total={CHOOSE_SECONDS}
            />
          )
        }
      />
    </PhaseTransition>
  );
}
