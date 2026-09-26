import { useScoreTableSequence } from "../../hooks/useScoreTableSequence";
import type { TurnScoreRow } from "../../utils/turnScores";
import { ScoreRow } from "./ScoreRow";
import { useRayadoSfxContext } from "../../hooks/rayadoSfxContext";

interface TurnScoreTableProps {
  /** Ordenadas por el puntaje de antes del turno (ver buildTurnScoreRows). */
  rows: readonly TurnScoreRow[];
  animated: boolean;
  startDelay: number;
  onDone: () => void;
}

/** Tabla del turno (`.score-list` de la referencia); la secuencia vive en useScoreTableSequence. */
export function TurnScoreTable({ rows, animated, startDelay, onDone }: TurnScoreTableProps) {
  const sfx = useRayadoSfxContext();
  const { shown, valueOf, bindRow } = useScoreTableSequence({ rows, animated, startDelay, sfx, onDone });
  return (
    <div aria-label="Puntos del turno" role="list" className="flex w-full flex-col gap-2">
      {shown.map(row => {
        const { plus, total } = valueOf(row);
        return (
          <div role="listitem" key={row.id}>
            <ScoreRow ref={bindRow(row.id)} row={row} plus={plus} total={total} />
          </div>
        );
      })}
    </div>
  );
}
