import { useState } from "react";
import { Btn } from "../../../../components/Btn";
import logo from "../../assets/logo.png";

interface IntroScreenProps {
  onStart: () => void;
}

// The one-time "get ready" beat between "Empezar partida" and the first
// card: sets the pass-and-play expectation (everyone's about to see their
// own card, then hand the device along) before the reveal flow itself
// starts. Only shown for a brand-new match — see startRound in LocalGame.
export function IntroScreen({ onStart }: IntroScreenProps) {
  // A beat slower than the usual button tap: this is the hinge between
  // setup and actually playing, so it's worth a moment of "and... go" fade
  // instead of an instant cut to the first card.
  const [leaving, setLeaving] = useState(false);

  const handleStart = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onStart, 480);
  };

  return (
    <div
      className={`impostor-intro-scene${leaving ? " is-leaving" : ""}`}
      style={{
        minHeight: "calc(100dvh - 140px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "0 8px",
      }}
    >
      <style>{`
        .impostor-intro-scene {
          transition: opacity 0.48s ease-out, transform 0.48s cubic-bezier(0.4, 0, 1, 1);
        }
        .impostor-intro-scene.is-leaving {
          opacity: 0;
          transform: scale(0.94);
        }
        .impostor-intro-btn {
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease-out, box-shadow 0.25s ease-out;
        }
        .impostor-intro-btn:hover {
          transform: translateY(-3px) scale(1.04);
          filter: brightness(1.25);
          box-shadow: 0 10px 28px var(--jt-accent-border-soft, rgba(127,119,221,0.45));
        }
        .impostor-intro-btn:active {
          transform: translateY(0) scale(0.93);
          filter: brightness(1.05);
          box-shadow: none;
        }
        .impostor-intro-logo {
          animation: impostor-intro-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes impostor-intro-pop {
          from { opacity: 0; transform: scale(0.85) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <img
        src={logo}
        alt=""
        className="impostor-intro-logo"
        style={{ width: 120, height: 120, objectFit: "contain", borderRadius: 24, marginBottom: 24 }}
      />
      <h2 style={{ margin: "0 0 12px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>Comienza la partida</h2>
      <p style={{ margin: "0 0 32px", fontSize: 14, color: "var(--jt-muted-text)", lineHeight: 1.5, maxWidth: 280 }}>
        Cada jugador toca su carta en su turno y pasa el dispositivo al siguiente.
      </p>
      <div style={{ width: "100%", maxWidth: 320 }}>
        <Btn onClick={handleStart} disabled={leaving} className="impostor-intro-btn">
          Comenzar
        </Btn>
      </div>
    </div>
  );
}
