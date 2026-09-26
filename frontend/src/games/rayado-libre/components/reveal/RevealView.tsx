import { useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { GameScreenLayout } from "../../../../components/game-kit/GameScreenLayout";
import { canAnimateNow, useMountMotion } from "../../hooks/useMountMotion";
import type { TurnScoreRow } from "../../utils/turnScores";
import { RevealWord, STROKE_MS } from "./RevealWord";
import { TurnScoreTable } from "./TurnScoreTable";
import { useRayadoSfxContext } from "../../hooks/rayadoSfxContext";

interface RevealViewProps {
  word: string;
  rows: readonly TurnScoreRow[];
  /** El botón de abajo (o su reemplazo); aparece cuando termina la tabla. */
  foot: ReactNode;
  /** Algo más debajo de la tabla (online: el chat del turno). */
  children?: ReactNode;
}

/**
 * Pantalla de revelación (`#sReveal` de la referencia), compartida por el
 * modo online y el local: la palabra con su pincelada, la tabla del turno y
 * el botón de abajo, que aparece recién cuando la tabla terminó de contar y
 * reordenarse.
 */
export function RevealView({ word, rows, foot, children }: RevealViewProps) {
  const sfx = useRayadoSfxContext();
  const animated = useMountMotion();
  const [tableDone, setTableDone] = useState(!animated);

  // La salpicadura acompaña la pincelada (aunque el movimiento esté reducido: es sonido).
  useEffect(() => {
    if (canAnimateNow()) sfx.play("splat");
    // Solo al aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <GameScreenLayout
      center={
        <div className="mx-auto flex w-full max-w-[480px] flex-col items-center pt-5 text-center font-figtree text-rl-ink">
          <RevealWord word={word} animated={animated} />
          <TurnScoreTable rows={rows} animated={animated} startDelay={STROKE_MS} onDone={() => setTableDone(true)} />
          {children && <div className="mt-4 w-full text-left">{children}</div>}
        </div>
      }
      stickyBottom={
        <div
          className={clsx(
            "transition-opacity duration-[250ms] motion-reduce:transition-none",
            tableDone ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {foot}
        </div>
      }
    />
  );
}
