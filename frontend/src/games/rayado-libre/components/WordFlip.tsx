import { useEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";

// Al pedir otra palabra, la palabra gira en X al cambiar.
const FLIP: Keyframe[] = [{ transform: "rotateX(90deg)" }, { transform: "none" }];
const FLIP_MS = 350;

interface WordFlipProps {
  /** La palabra: cuando cambia (después del primer render) se anima el giro. */
  flipKey?: string;
  children: ReactNode;
}

/** Envuelve la palabra de la cabecera del turno para girarla cuando se pide otra. */
export function WordFlip({ flipKey, children }: WordFlipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const prevKey = useRef(flipKey);
  const reduced = usePrefersReducedMotion();
  const canAnimate = useAnimationGate();

  useEffect(() => {
    if (prevKey.current === flipKey) return;
    prevKey.current = flipKey;
    if (reduced || !canAnimate()) return;
    ref.current?.animate?.(FLIP, { duration: FLIP_MS });
    // Solo cuando cambia la palabra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipKey]);

  return <div ref={ref}>{children}</div>;
}
