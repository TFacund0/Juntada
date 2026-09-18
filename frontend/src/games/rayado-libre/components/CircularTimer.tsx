import { useCountdownSeconds, timerUrgencyColor } from "../../../components/game-kit/hooks/useCountdownSeconds";

/**
 * Reloj circular (a diferencia del `RingTimer` grande y centrado de
 * impostor, o la barra del `Timer` de game-kit) para quedar fijo en una
 * esquina/envolviendo otro elemento sin competir por el centro de la
 * pantalla. Comparte el tick de `useCountdownSeconds` con RingTimer en vez
 * de reimplementarlo.
 *
 * `size`/`strokeWidth` lo hacen reusable en dos contextos bien distintos:
 * chico con el número adentro (esquina del tablero en "drawing") o grande
 * como anillo alrededor de un avatar sin número, dejando que el propio
 * avatar ocupe el centro (pantalla de espera en "choosing").
 */
export function CircularTimer({
  timerEnd,
  total,
  size = 64,
  strokeWidth = 6,
  showNumber = true,
}: {
  timerEnd: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  showNumber?: boolean;
}) {
  const { secs, total: t } = useCountdownSeconds(timerEnd, total);
  const progress = t > 0 ? Math.max(0, Math.min(1, secs / t)) : 0;
  const urgent = secs > 0 && secs <= 5;
  const color = timerUrgencyColor(secs);
  const radius = size / 2 - strokeWidth / 2 - 1;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div
      className="rl-circular-timer"
      style={{
        position: "relative",
        width: size,
        height: size,
        animation: urgent ? "rl-circular-timer-urgent-pulse 0.5s ease-in-out infinite" : undefined,
      }}
    >
      <style>{`
        @keyframes rl-circular-timer-urgent-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rl-circular-timer { animation: none !important; }
        }
      `}</style>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={strokeWidth} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
        />
      </svg>
      {showNumber && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {secs}
        </span>
      )}
    </div>
  );
}
