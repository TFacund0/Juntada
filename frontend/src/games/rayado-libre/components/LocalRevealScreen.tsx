import { useMemo } from "react";
import type { LocalPlayer } from "../types/localGame";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { buildTurnScoreRows } from "../utils/turnScores";
import { toStringKeys } from "../utils/localTurn";
import { RevealView } from "./reveal/RevealView";
import { PrimaryButton } from "./PrimaryButton";

interface LocalRevealScreenProps {
  word: string | null;
  players: LocalPlayer[];
  drawerId: number | null;
  scores: Record<number, number>;
  roundPoints: Record<number, number>;
  /** Segundos que quedaban cuando acertó cada uno. */
  guessSeconds: Record<number, number>;
  isLastTurn: boolean;
  goToNextTurn: () => void;
  sfx: RayadoSfx;
}

/** Pantalla "reveal" del modo local: la misma revelación y tabla que online, con un solo botón para toda la mesa (no hay "listo" por jugador). */
export function LocalRevealScreen({
  word,
  players,
  drawerId,
  scores,
  roundPoints,
  guessSeconds,
  isLastTurn,
  goToNextTurn,
  sfx,
}: LocalRevealScreenProps) {
  const rows = useMemo(
    () =>
      buildTurnScoreRows({
        players: players.map(p => ({ id: String(p.id), name: p.name })),
        drawerId: drawerId == null ? null : String(drawerId),
        roundPoints: toStringKeys(roundPoints),
        guessSeconds: toStringKeys(guessSeconds),
        totals: toStringKeys(scores),
      }),
    [players, drawerId, roundPoints, guessSeconds, scores],
  );

  return (
    <RevealView
      word={word ?? ""}
      rows={rows}
      sfx={sfx}
      foot={<PrimaryButton onClick={goToNextTurn}>{isLastTurn ? "Ver podio" : "Siguiente turno"}</PrimaryButton>}
    />
  );
}
