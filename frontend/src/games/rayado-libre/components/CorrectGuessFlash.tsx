import { createPortal } from "react-dom";
import { RAYADO_RAINBOW } from "../rainbow";

const RAY_RING = [...RAYADO_RAINBOW, RAYADO_RAINBOW[0]].join(", ");
const TEXT_GRADIENT = RAYADO_RAINBOW.join(", ");

/**
 * Celebración breve (~1.3s) cuando adivinás correctamente: reemplaza el
 * cartelito chico que antes vivía arriba de la pantalla por un flash
 * centrado — anillo arcoíris girando de fondo + el texto entrando con un
 * rebote. Portal a document.body (mismo motivo que WordRevealSweep/
 * StickyActionBar: PhaseTransition anima con `transform` al montar la
 * pantalla, atrapando cualquier `position: fixed` de acá adentro si no se
 * escapa del árbol) y `pointerEvents: none` para no bloquear el tablero
 * mientras dura.
 */
export function CorrectGuessFlash({ points }: { points: number }) {
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: "var(--jt-z-fullscreen-flash, 200)",
      }}
    >
      <style>{`
        @keyframes rl-guess-flash-pop {
          0% { transform: scale(0.4) rotate(-6deg); opacity: 0; }
          55% { transform: scale(1.15) rotate(2deg); opacity: 1; }
          75% { transform: scale(1) rotate(0deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 0; }
        }
        @keyframes rl-guess-flash-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rl-guess-flash-ring-fade { 0%, 70% { opacity: 0.22; } 100% { opacity: 0; } }
        .rl-guess-flash-ring {
          position: absolute;
          width: 320px;
          height: 320px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, ${RAY_RING});
          filter: blur(3px);
          animation: rl-guess-flash-spin 2.2s linear infinite, rl-guess-flash-ring-fade 1.3s ease-out forwards;
        }
        .rl-guess-flash-card {
          position: relative;
          text-align: center;
          animation: rl-guess-flash-pop 1.3s cubic-bezier(0.22,1,0.36,1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .rl-guess-flash-ring, .rl-guess-flash-card { animation: none !important; opacity: 0; }
        }
      `}</style>
      <div className="rl-guess-flash-ring" />
      <div className="rl-guess-flash-card">
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#5DCAA5" }}>
          ¡Correcto!
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: "-0.02em",
            background: `linear-gradient(90deg, ${TEXT_GRADIENT})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          ¡Adivinaste!
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 800, color: "#5DCAA5" }}>+{points} puntos</p>
      </div>
    </div>,
    document.body,
  );
}
