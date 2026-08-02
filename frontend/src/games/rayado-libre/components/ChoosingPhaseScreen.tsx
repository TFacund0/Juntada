import { S } from "../../../theme/styles";
import { Btn } from "../../../components/ui/Btn";
import { Avatar } from "../../../components/ui/Avatar";
import { Timer } from "../../../components/game-kit/Timer";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import type { RoundViewProps } from "../../gameTypes";
import type { RayadoLibreRoundState } from "../types/roundView";

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
      <p style={{ textAlign: "center", fontSize: 13, color: "#9089c0", marginBottom: 8 }}>
        Turno {round.turnNumber}/{round.totalTurns}
      </p>
      {round.chooseTimerEnd && <Timer timerEnd={round.chooseTimerEnd} total={CHOOSE_SECONDS} label="Tiempo para elegir palabra" />}
      {drawerOffline && (
        <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginBottom: 8 }}>
          ⚠️ {drawerPlayer?.name} se desconectó — se elige una palabra sola si no vuelve a tiempo
        </p>
      )}

      {isDrawer ? (
        <div style={S.card}>
          <span style={S.label}>Elegí qué vas a dibujar</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {(wordChoices ?? []).map(w => (
              <Btn key={w} variant="success" onClick={() => send({ type: "choose_word", word: w })}>
                {w}
              </Btn>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...S.cardHighlight, display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Avatar name={drawerPlayer?.name ?? "?"} size={40} />
          <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{drawerPlayer?.name} está eligiendo la palabra...</p>
        </div>
      )}
    </PhaseTransition>
  );
}
