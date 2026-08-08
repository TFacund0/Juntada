import { memo, useState, useEffect, useRef } from "react";
import { timerUrgencyColor } from "./hooks/useCountdownSeconds";

interface TimerProps {
  timerEnd: number;
  total?: number;
  label?: string;
}

/**
 * Avanza su propia cuenta regresiva vía estado interno (no necesita
 * cambios de props para eso), pero su padre (`RoundView`) se re-renderiza
 * en cada broadcast `"state"` de WS — memoizado para que esos re-renders
 * no relacionados no vuelvan a correr el cuerpo de render de este
 * componente entre sus propios ticks de 500ms.
 */
export const Timer = memo(function Timer({ timerEnd, total, label = "Tiempo" }: TimerProps) {
  const [secs, setSecs] = useState(0);
  const totalRef = useRef(total || 1);

  useEffect(() => {
    totalRef.current = total || Math.max(1, Math.ceil((timerEnd - Date.now()) / 1000));
  }, [timerEnd, total]);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      setSecs(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [timerEnd]);

  const color = timerUrgencyColor(secs);
  const pct = secs > 0 ? Math.round((secs / totalRef.current) * 100) : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--jt-muted-text)" }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{secs}s</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.5s, background 0.5s" }} />
      </div>
    </div>
  );
});
