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
 * Ocupa todo el alto debajo del navbar (se come el `pb-[60px]` del shell,
 * como DrawingStage) para que el botón quede abajo en el flujo normal y no
 * fijo encima del recap. El recap parte de `h-44` y crece con lo que sobra,
 * con su propio scroll (`grow` con base `auto`, no `flex-1`: una base 0% en
 * un alto indefinido se vuelve el contenido y el recap dejaría de
 * scrollear). Como el alto de la pantalla es un mínimo, si no entra
 * (celular horizontal) la página scrollea en vez de tapar la tabla.
 */
const REVEAL_SCREEN = "-mb-[60px] min-h-[calc(100dvh-var(--jt-content-pad-top))] pb-[calc(12px+env(safe-area-inset-bottom,0px))]";

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
      className={REVEAL_SCREEN}
      center={
        <div className="mx-auto flex w-full max-w-[480px] grow flex-col items-center pt-5 text-center font-figtree text-rl-ink">
          <div className="flex w-full flex-none flex-col items-center">
            <RevealWord word={word} animated={animated} />
            <TurnScoreTable rows={rows} animated={animated} startDelay={STROKE_MS} onDone={() => setTableDone(true)} />
          </div>
          {children && <div className="mt-4 flex h-44 w-full grow flex-col text-left">{children}</div>}
        </div>
      }
      bottom={
        <div
          className={clsx(
            "mx-auto w-full max-w-[480px] transition-opacity duration-[250ms] motion-reduce:transition-none",
            tableDone ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {foot}
        </div>
      }
    />
  );
}
