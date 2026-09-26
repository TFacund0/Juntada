import { useEffect, useRef } from "react";
import type { RayadoSfx } from "./useRayadoSfx";
import { canAnimateNow } from "./useMountMotion";

/** El sonido de fin de turno (`sfx.end` de la referencia) cuando se pasa de dibujar a la revelación. */
export function useTurnEndSound(phase: string, sfx: Pick<RayadoSfx, "play">): void {
  const prev = useRef(phase);
  useEffect(() => {
    if (prev.current === "drawing" && phase === "reveal" && canAnimateNow()) sfx.play("end");
    prev.current = phase;
    // Solo al cambiar de fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
}
