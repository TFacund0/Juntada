import { RevealCountdown } from "../../../components/game-kit/RevealCountdown";
import { RAYADO_RAINBOW } from "../rainbow";

const INK_RING = [...RAYADO_RAINBOW, RAYADO_RAINBOW[0]].join(", ");

/**
 * Envuelve el `RevealCountdown` compartido con un fondo giratorio del mismo
 * anillo arcoíris del logo, en vez de dejar el número solo sobre el fondo
 * default — específico de rayado-libre (colores hardcodeados del propio
 * logo), no va al game-kit.
 */
export function InkSweepReveal({ count, label }: { count: number; label?: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <style>{`
        @keyframes rl-ink-sweep-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          position: "absolute",
          inset: "-50%",
          background: `conic-gradient(from 0deg, ${INK_RING})`,
          opacity: 0.22,
          animation: "rl-ink-sweep-spin 6s linear infinite",
        }}
      />
      <div style={{ position: "relative" }}>
        <RevealCountdown count={count} label={label} />
      </div>
    </div>
  );
}
