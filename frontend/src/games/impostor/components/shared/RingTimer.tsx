import { memo } from "react";
import { useCountdownSeconds, timerUrgencyColor } from "../../../../components/game-kit/useCountdownSeconds";

const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface RingTimerProps {
  timeLeft: number;
  total: number;
  label?: string;
}

// A big centered countdown ring instead of a thin bar, so a timer actually
// fills the screen instead of leaving dead space above/below — with a
// pulsing warning near the end. Purely presentational (just timeLeft/total
// in seconds); see RingTimerLive below for the server-timestamp-driven
// wrapper online actually renders. Originally built just for LocalGame's
// discussion phase, now shared by every countdown across both modes
// (discussion, the online clue-giving timer, the reconnect-grace timer
// during voting) instead of each one reinventing its own bar.
export function RingTimer({ timeLeft, total, label = "Tiempo" }: RingTimerProps) {
  const urgent = timeLeft > 0 && timeLeft <= 5;
  const progress = total > 0 ? Math.max(0, Math.min(1, timeLeft / total)) : 0;
  const color = timerUrgencyColor(timeLeft);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: 24,
        animation: urgent ? "impostor-ring-timer-urgent-pulse 0.5s ease-in-out infinite" : undefined,
      }}
    >
      <style>{`
        @keyframes impostor-ring-timer-urgent-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .impostor-ring-timer-circle {
          transition: stroke-dashoffset 1s linear, stroke 0.5s ease;
        }
      `}</style>
      <p
        style={{
          marginBottom: 14,
          fontSize: 13,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
          color: "var(--jt-muted-text)",
        }}
      >
        {label}
      </p>
      <div style={{ position: "relative", width: 200, height: 200 }}>
        <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
          <circle
            className="impostor-ring-timer-circle"
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 48, fontWeight: 800, color, lineHeight: 1 }}>{timeLeft}</span>
          <span style={{ fontSize: 13, color: "var(--jt-muted-text)", marginTop: 4 }}>segundos</span>
        </div>
      </div>
    </div>
  );
}

interface RingTimerLiveProps {
  timerEnd: number;
  total?: number;
  label?: string;
}

export const RingTimerLive = memo(function RingTimerLive({ timerEnd, total, label }: RingTimerLiveProps) {
  const { secs, total: t } = useCountdownSeconds(timerEnd, total);
  return <RingTimer timeLeft={secs} total={t} label={label} />;
});
