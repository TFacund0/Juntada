import { RAYADO_RAINBOW } from "../rainbow";

const SWEEP_RING = [...RAYADO_RAINBOW, RAYADO_RAINBOW[0]].join(", ");

/**
 * Puente breve (600-800ms) entre "drawing" y "reveal": un barrido de color
 * con la palabra apareciendo, para que el salto de "tablero en vivo" a
 * "palabra revelada + tabla de puntos" no se sienta instantáneo. A
 * diferencia de `InkSweepReveal` (que bloquea con un contador antes de
 * "result", una sola vez por partida), este no cuenta nada — se desmonta
 * solo por timer en RoundView, mismo patrón que `turnFlashName`.
 */
export function WordRevealSweep({ word }: { word: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <style>{`
        @keyframes rl-word-sweep-bg {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
        @keyframes rl-word-sweep-in {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rl-word-sweep-bg { animation: none !important; }
          .rl-word-sweep-text { animation: none !important; }
        }
      `}</style>
      <div
        className="rl-word-sweep-bg"
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(90deg, transparent, ${SWEEP_RING}, transparent)`,
          opacity: 0.25,
          animation: "rl-word-sweep-bg 0.7s ease-out",
        }}
      />
      <div
        className="rl-word-sweep-text"
        style={{ position: "relative", textAlign: "center", animation: "rl-word-sweep-in 0.5s ease-out" }}
      >
        <p style={{ fontSize: 13, color: "#9089c0", margin: "0 0 4px" }}>La palabra era</p>
        <p style={{ fontSize: 32, fontWeight: 800, color: "#AFA9EC", margin: 0, letterSpacing: "-0.02em" }}>{word}</p>
      </div>
    </div>
  );
}
