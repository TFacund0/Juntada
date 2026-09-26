import { forwardRef, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import clsx from "clsx";

interface CountdownRingProps {
  /** Lo que queda del tiempo (1 = lleno, 0 = vacío). */
  progress: number;
  /** Late (animate-rl-beat) mientras es true. */
  urgent: boolean;
  /** Tamaño y grosor (`after:inset-*`, el hueco del centro). */
  className: string;
  label: string;
  children?: ReactNode;
}

/**
 * El anillo arcoíris que se vacía (conic-gradient animando `--p`): el reloj
 * del turno (TimerRing, con el número adentro) y el anillo alrededor del
 * avatar de quien elige palabra (WaitingForWordCard). Conserva la clase
 * `rl-circular-timer` que usan useGuessFx y los tests para encontrarlo.
 */
export const CountdownRing = forwardRef<HTMLDivElement, CountdownRingProps>(function CountdownRing(
  { progress, urgent, className, label, children },
  ref,
) {
  // Sin transición de --p al montar ni al volver de otra pestaña: el anillo
  // aparece directamente en el valor actual en vez de vaciarse de golpe.
  const [instant, setInstant] = useState(true);
  useEffect(() => {
    let raf = 0;
    const settle = () => {
      setInstant(true);
      raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => setInstant(false))));
    };
    settle();
    const onVisibility = () => {
      if (document.visibilityState === "visible") settle();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div
      ref={ref}
      role="timer"
      aria-label={label}
      className={clsx(
        "rl-circular-timer relative flex-none rounded-full",
        "bg-[conic-gradient(var(--color-rl-r1),var(--color-rl-r2),var(--color-rl-r3),var(--color-rl-r4),var(--color-rl-r5),var(--color-rl-r1))]",
        // Lo que ya pasó se tapa con un segundo conic-gradient; el centro, con el fondo.
        "before:absolute before:inset-0 before:rounded-full before:bg-[conic-gradient(transparent_calc(var(--p)*360deg),#2a2446_0)]",
        "after:absolute after:rounded-full after:bg-jt-bg",
        !instant && "transition-[--p] duration-700 ease-[cubic-bezier(.5,0,.2,1)]",
        urgent && "animate-rl-beat",
        "motion-reduce:animate-none motion-reduce:transition-none",
        className,
      )}
      // --p es el valor que se anima (0..1), cambia cada segundo.
      style={{ "--p": Math.min(1, Math.max(0, progress)).toFixed(4) } as CSSProperties}
    >
      {children}
    </div>
  );
});
