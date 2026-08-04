import { Avatar } from "../../../components/ui/Avatar";
import { RAYADO_RAINBOW } from "../rainbow";

const GLOW_RING = [...RAYADO_RAINBOW, RAYADO_RAINBOW[0]].join(", ");

/**
 * Pantalla "pasale el dispositivo" del modo local, entre que termina el
 * turno anterior y quien dibuja confirma que ya tiene el aparato en mano —
 * mismo tratamiento visual (avatar + halo arcoíris girando) que
 * `WaitingForWordCard` usa online para el momento equivalente (esperando a
 * que alguien más elija), así el botón grande no queda solo en medio de una
 * pantalla vacía.
 */
export function PassDeviceCard({ drawerName, onReady }: { drawerName: string; onReady: () => void }) {
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
        @keyframes rl-pass-glow-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rl-pass-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
        .rl-pass-glow {
          position: absolute;
          inset: -18px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, ${GLOW_RING});
          opacity: 0.18;
          filter: blur(6px);
          animation: rl-pass-glow-spin 6s linear infinite;
        }
        .rl-pass-btn {
          animation: rl-pass-pulse 2.2s ease-in-out infinite;
          transition: transform 0.15s ease;
        }
        .rl-pass-btn:hover, .rl-pass-btn:focus-visible { transform: scale(1.06); }
        .rl-pass-btn:active { transform: scale(0.97); }
        @media (prefers-reduced-motion: reduce) {
          .rl-pass-glow, .rl-pass-btn { animation: none !important; }
        }
      `}</style>
      <div style={{ position: "relative", width: 132, height: 132, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="rl-pass-glow" />
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
        <p style={{ margin: "6px 0 0", fontSize: 14, color: "#9089c0" }}>
          Pasale el dispositivo — el resto no tiene que ver la pantalla todavía
        </p>
      </div>
      <button
        className="rl-pass-btn"
        onClick={onReady}
        style={{
          border: "none",
          cursor: "pointer",
          borderRadius: 999,
          padding: "16px 30px",
          fontSize: 15,
          fontWeight: 800,
          color: "#fff",
          background: "linear-gradient(90deg,#7F77DD,#5DCAA5)",
          boxShadow: "0 10px 26px -10px rgba(127,119,221,0.6)",
        }}
      >
        📱 Ya tengo el dispositivo
      </button>
    </div>
  );
}
