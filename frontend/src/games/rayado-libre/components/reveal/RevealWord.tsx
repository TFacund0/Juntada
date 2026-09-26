import { useEffect, useRef } from "react";

// `revealScreen` de la referencia: la pincelada se pinta de izquierda a
// derecha y después la palabra se destapa con clip-path.
export const STROKE_MS = 520;
const TEXT_MS = 420;
const STROKE_IN: Keyframe[] = [{ transform: "scaleX(0) skewX(-8deg)" }, { transform: "scaleX(1) skewX(-8deg)" }];
const TEXT_IN: Keyframe[] = [{ clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0 0 0)" }];

interface RevealWordProps {
  word: string;
  /** Si se anima la entrada (ver useMountMotion); si no, se ve directo terminada. */
  animated: boolean;
}

/**
 * "La palabra era" y la palabra sobre una pincelada arcoíris. El estado
 * final es el del CSS: la animación solo arranca desde el vacío (`fill:
 * backwards`), así sin Web Animations la palabra igual se ve. El texto es la
 * palabra tal cual (las mayúsculas son de CSS).
 */
export function RevealWord({ word, animated }: RevealWordProps) {
  const strokeRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animated) return;
    strokeRef.current?.animate?.(STROKE_IN, { duration: STROKE_MS, easing: "cubic-bezier(.6,0,.2,1)", fill: "backwards" });
    textRef.current?.animate?.(TEXT_IN, { duration: TEXT_MS, delay: STROKE_MS, easing: "ease-out", fill: "backwards" });
    // Solo al aparecer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="text-[15px] text-rl-muted">La palabra era</div>
      <div className="relative mb-6 mt-2.5 inline-block px-[18px] py-1">
        <div
          ref={strokeRef}
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[8%] top-[18%] origin-left rounded-[40%_12%_38%_16%] bg-[linear-gradient(90deg,var(--color-rl-r1),var(--color-rl-r2),var(--color-rl-r3),var(--color-rl-r4),var(--color-rl-r5))] [transform:skewX(-8deg)]"
        />
        <div
          ref={textRef}
          className="relative font-marker text-[clamp(34px,11vw,52px)] uppercase text-white [overflow-wrap:anywhere] [text-shadow:0_3px_0_rgba(0,0,0,.35)]"
        >
          {word}
        </div>
      </div>
    </>
  );
}
