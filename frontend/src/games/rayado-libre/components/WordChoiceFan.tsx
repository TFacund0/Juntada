import type { CSSProperties } from "react";
import { S } from "../../../theme/styles";
import { RAYADO_RAINBOW } from "../rainbow";

/**
 * Las 3 palabras a elegir, en abanico de cartas con rotación/color por
 * posición — compartido entre el modo online (`ChoosingPhaseScreen`) y el
 * modo local (`WordRevealScreen`), que llegan a este mismo momento por
 * caminos distintos (elegir sobre la red vs. elegir a mano en el mismo
 * dispositivo) pero muestran exactamente la misma pantalla.
 */
export function WordChoiceFan({
  words,
  onChoose,
  label = "Elegí qué vas a dibujar",
}: {
  words: string[];
  onChoose: (word: string) => void;
  label?: string;
}) {
  return (
    <div
      style={{
        minHeight: "min(50vh, 420px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <span style={{ ...S.label, display: "block", marginBottom: 22 }}>{label}</span>
      <style>{`
        .rl-word-fan { display: flex; justify-content: center; align-items: flex-end; gap: 4px; flex-wrap: wrap; }
        .rl-word-card {
          width: 118px; height: 156px; border-radius: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; text-align: center;
          font-size: 17px; font-weight: 800; color: #fff; padding: 10px; box-sizing: border-box;
          background: var(--jt-card-bg, rgba(255,255,255,0.06));
          border: 1px solid var(--jt-card-border, rgba(127,119,221,0.2));
          border-top: 4px solid var(--rl-card-accent);
          box-shadow: 0 8px 20px -8px rgba(0,0,0,0.5);
          transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease;
          transform: rotate(var(--rl-card-rotate)) translateY(var(--rl-card-lift));
        }
        .rl-word-card:hover, .rl-word-card:focus-visible {
          transform: rotate(0deg) translateY(-10px) scale(1.05);
          box-shadow: 0 14px 28px -10px rgba(0,0,0,0.55);
        }
        .rl-word-card:active { transform: rotate(0deg) translateY(-4px) scale(0.98); }
        @media (prefers-reduced-motion: reduce) {
          .rl-word-card { transition: none; transform: none; }
        }
        /* Sobra ancho y alto en desktop (mismo criterio que el podio
           final) — las cartas crecen en vez de quedarse al tamaño
           pensado para mobile. */
        @media (min-width: 1024px) {
          .rl-word-fan { gap: 10px; }
          .rl-word-card { width: 180px; height: 236px; font-size: 24px; border-radius: 18px; }
        }
      `}</style>
      <div className="rl-word-fan">
        {words.map((w, i, arr) => {
          const mid = (arr.length - 1) / 2;
          const offset = i - mid;
          const cardStyle = {
            "--rl-card-accent": RAYADO_RAINBOW[i % RAYADO_RAINBOW.length],
            "--rl-card-rotate": `${offset * 8}deg`,
            "--rl-card-lift": `${Math.abs(offset) * 10}px`,
          } as CSSProperties;
          return (
            <button key={w} className="rl-word-card" style={cardStyle} onClick={() => onChoose(w)}>
              {w}
            </button>
          );
        })}
      </div>
    </div>
  );
}
