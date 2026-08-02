import "../recamara.css";
import type { ConfigPanelProps } from "../../gameTypes";

// Recámara has no adjustable rules — same fixed duel as local mode (5 vidas,
// 3 a 8 cartuchos, 2 ítems por recarga). Nothing for the host to tweak
// here, just a quick reminder of the headcount before starting.
export function ConfigPanel(_props: ConfigPanelProps) {
  return (
    <div className="recamara">
      <div className="setup-card">
        <h2>Recámara</h2>
        <p style={{ margin: 0, color: "var(--rec-ink-dim)", fontSize: 14, lineHeight: 1.5 }}>
          Duelo de 2 a 6 jugadores, sin configuración extra — 5 vidas cada uno, 3 a 8 cartuchos por recarga y 2 ítems nuevos cada vez que se
          vacía la recámara.
        </p>
      </div>
    </div>
  );
}
