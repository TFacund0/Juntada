import { Avatar } from "../../../components/ui/Avatar";
import { RAYADO_RAINBOW } from "../rainbow";
import { CircularTimer } from "./CircularTimer";

const GLOW_RING = [...RAYADO_RAINBOW, RAYADO_RAINBOW[0]].join(", ");

/**
 * Pantalla de espera para quien no dibuja durante "choosing" — avatar grande
 * envuelto en el mismo `CircularTimer` que ya usa "drawing" (acá agrandado,
 * sin número, la cuenta regresiva se ve en el propio anillo) en vez de la
 * barra de `Timer` compartida, más un halo arcoíris de fondo para ambiente.
 * `min-height` (no `flex: 1 1 auto`) porque nada en la cadena de ancestros
 * hasta acá (`PhaseTransition`, `ScreenFade`, el wrap de la página) es un
 * contenedor flex — sin una caja con altura real no hay dentro de qué
 * centrar verticalmente.
 */
export function WaitingForWordCard({ drawerName, timerEnd, total }: { drawerName: string; timerEnd?: number; total?: number }) {
  return (
    <div
      style={{
        minHeight: "min(50vh, 420px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <style>{`
        @keyframes rl-waiting-glow-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rl-waiting-dot { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        .rl-waiting-glow {
          position: absolute;
          inset: -18px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, ${GLOW_RING});
          opacity: 0.18;
          filter: blur(6px);
          animation: rl-waiting-glow-spin 6s linear infinite;
        }
        .rl-waiting-dot { animation: rl-waiting-dot 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .rl-waiting-glow { animation: none !important; }
        }
      `}</style>
      <div style={{ position: "relative", width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="rl-waiting-glow" />
        {timerEnd != null && total != null && (
          <div style={{ position: "absolute", inset: 0 }}>
            <CircularTimer timerEnd={timerEnd} total={total} size={132} strokeWidth={5} showNumber={false} />
          </div>
        )}
        <Avatar name={drawerName} size={92} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            background: "linear-gradient(90deg,#AFA9EC,#5DCAA5)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {drawerName}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 15, color: "#9089c0" }}>
          está eligiendo la palabra
          <span className="rl-waiting-dot" style={{ animationDelay: "0s" }}>
            .
          </span>
          <span className="rl-waiting-dot" style={{ animationDelay: "0.2s" }}>
            .
          </span>
          <span className="rl-waiting-dot" style={{ animationDelay: "0.4s" }}>
            .
          </span>
        </p>
      </div>
    </div>
  );
}
