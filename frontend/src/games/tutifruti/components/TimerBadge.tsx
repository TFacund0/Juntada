import type { CSSProperties } from "react";
import { formatTime } from "../utils/formatTime";

/**
 * Badge de "tiempo restante" — chip chico de una línea, sticky mientras se
 * scrollea. Compartido por Writing y Review (mismo diseño en las dos, a
 * propósito — antes Writing tenía su propia versión grande con anillo,
 * pero antes que tener dos diseños distintos para lo mismo se unificó en
 * este, ya pensado para convivir al lado de varias cards sin dominar la
 * pantalla).
 */
export function TimerBadge({ label, timeLeft }: { label: string; timeLeft: number }) {
  const urgent = timeLeft < 15;
  const color = urgent ? "#E24B4A" : timeLeft < 30 ? "#EF9F27" : "#5DCAA5";
  const display = formatTime(timeLeft);

  return (
    <div
      className={`tf-timer-chip tf-timer-sticky${urgent ? " tf-timer-chip-urgent" : ""}`}
      style={{ "--tf-timer-color": color } as CSSProperties}
    >
      <span className="tf-timer-chip-dot" />
      {label} <strong>{display}</strong>
    </div>
  );
}
