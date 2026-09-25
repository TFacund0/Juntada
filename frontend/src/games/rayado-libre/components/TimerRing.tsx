import { useEffect, useRef, useState, type CSSProperties } from "react";
import clsx from "clsx";
import { useCountdownSeconds } from "../../../components/game-kit/hooks/useCountdownSeconds";
import { usePrefersReducedMotion } from "../../../components/game-kit/hooks/usePrefersReducedMotion";
import { useAnimationGate } from "../../../components/game-kit/hooks/useAnimationGate";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import { detectClockJump, isUrgent, jumpCountAt, type ClockSnapshot } from "../utils/clockJump";
import { clockJumpLabel } from "../utils/turnText";

// Tiempos y curvas de makeClock en la referencia.
const COUNT_MS = 700;
const RING_JUMP: Keyframe[] = [{ transform: "scale(1)" }, { transform: "scale(1.18) rotate(-12deg)" }, { transform: "none" }];
const BADGE_IN_OUT: Keyframe[] = [
  { opacity: 0, transform: "translateY(-6px) scale(.8)" },
  { opacity: 1, transform: "none", offset: 0.2 },
  { opacity: 1, offset: 0.8 },
  { opacity: 0 },
];
// Con movimiento reducido el cartel igual aparece (es información), solo sin desplazarse.
const BADGE_FADE: Keyframe[] = [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }];

interface TimerRingProps {
  timerEnd: number;
  total: number;
  /** Cuántos acertaron hasta ahora — junto con `timerEnd` distingue un salto por acierto de otros cambios del reloj. */
  correctCount: number;
  sfx: Pick<RayadoSfx, "play" | "vibrate">;
}

/**
 * Reloj del turno: anillo arcoíris (conic-gradient) que se vacía animando
 * `--p`, late con sonido y vibración en los últimos 10 segundos, y cuando un
 * acierto lo hace saltar de zona cuenta hacia abajo, gira y muestra el
 * cartel "¡El reloj saltó a N!". Conserva la clase `rl-circular-timer` que
 * usan los tests para encontrarlo.
 */
export function TimerRing({ timerEnd, total, correctCount, sfx }: TimerRingProps) {
  const { secs } = useCountdownSeconds(timerEnd, total);
  const reduced = usePrefersReducedMotion();
  const canAnimate = useAnimationGate();
  const ringRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [countOverride, setCountOverride] = useState<number | null>(null);
  const [badge, setBadge] = useState("");
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

  // Salto del reloj por un acierto en una zona nueva.
  const prev = useRef<ClockSnapshot>({ timerEnd, correctCount });
  useEffect(() => {
    const jump = detectClockJump(prev.current, { timerEnd, correctCount }, Date.now());
    prev.current = { timerEnd, correctCount };
    if (!jump || !canAnimate()) return;
    sfx.play("jump");
    setBadge(clockJumpLabel(jump.to));
    badgeRef.current?.animate?.(reduced ? BADGE_FADE : BADGE_IN_OUT, { duration: 1800 });
    if (reduced) return;
    ringRef.current?.animate?.(RING_JUMP, { duration: 500 });
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = (now - t0) / COUNT_MS;
      setCountOverride(t < 1 ? jumpCountAt(jump, t) : null);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setCountOverride(null);
    };
    // Solo reacciona a cambios del reloj o de los aciertos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerEnd, correctCount]);

  // Latido: sonido grave + vibración corta una vez por segundo al final.
  const urgent = isUrgent(secs);
  useEffect(() => {
    if (!urgent || !canAnimate()) return;
    sfx.play("beat");
    sfx.vibrate(8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs]);

  const progress = total > 0 ? Math.min(1, Math.max(0, secs / total)) : 0;
  return (
    <div className="relative flex-none">
      <div
        ref={ringRef}
        role="timer"
        aria-label={`Quedan ${secs} segundos`}
        className={clsx(
          "rl-circular-timer relative h-[54px] w-[54px] flex-none rounded-full",
          "bg-[conic-gradient(var(--color-rl-r1),var(--color-rl-r2),var(--color-rl-r3),var(--color-rl-r4),var(--color-rl-r5),var(--color-rl-r1))]",
          // Lo que ya pasó se tapa con un segundo conic-gradient; el centro, con el fondo.
          "before:absolute before:inset-0 before:rounded-full before:bg-[conic-gradient(transparent_calc(var(--p)*360deg),#2a2446_0)]",
          "after:absolute after:inset-[6px] after:rounded-full after:bg-jt-bg",
          !instant && "transition-[--p] duration-700 ease-[cubic-bezier(.5,0,.2,1)]",
          urgent && "animate-rl-beat",
          "motion-reduce:animate-none motion-reduce:transition-none",
          "@min-[1000px]:h-16 @min-[1000px]:w-16 short-screen:h-[46px] short-screen:w-[46px]",
        )}
        // --p es el valor que se anima (0..1), cambia cada segundo.
        style={{ "--p": progress.toFixed(4) } as CSSProperties}
      >
        <b className="absolute inset-0 z-[1] grid place-items-center text-[17px] font-extrabold tabular-nums @min-[1000px]:text-[20px]">
          {countOverride ?? secs}
        </b>
      </div>
      <div
        ref={badgeRef}
        role="status"
        className="pointer-events-none absolute right-0 top-[60px] z-[5] whitespace-nowrap rounded-lg bg-rl-warn px-2 py-[3px] text-[13px] font-extrabold text-[#1d1400] opacity-0"
      >
        {badge}
      </div>
    </div>
  );
}
