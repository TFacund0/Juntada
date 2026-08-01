import { S } from "../../../../theme/styles";
import logo from "../../assets/logo.webp";

interface FlipRevealCardProps {
  visible: boolean;
  onToggle: () => void;
  isImpostor: boolean;
  word: string;
  hint?: string | null;
  categoryLabel: string;
  showCategory: boolean;
  minHeight?: number;
}

// The 3D flip card showing "tap to reveal" (our logo) on one face and the
// actual word/impostor role on the other, with a role-colored border once
// flipped (red only for the impostor, the normal accent otherwise). Shared
// between LocalGame's pass-and-play RevealScreen and online's
// RoundPhaseScreen — same visual either way, just fed different visible/
// onToggle wiring since local gates it per turn and online just toggles
// freely on tap.
export function FlipRevealCard({
  visible,
  onToggle,
  isImpostor,
  word,
  hint,
  categoryLabel,
  showCategory,
  minHeight = 240,
}: FlipRevealCardProps) {
  return (
    <div className="impostor-reveal-flip-scene" style={{ minHeight }}>
      <style>{`
        .impostor-reveal-flip-scene {
          perspective: 1200px;
        }
        .impostor-reveal-flip-card {
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .impostor-reveal-flip-card.is-flipped {
          transform: rotateY(180deg);
        }
        .impostor-reveal-flip-face {
          backface-visibility: hidden;
        }
        .impostor-reveal-flip-face-back {
          position: absolute;
          inset: 0;
          transform: rotateY(180deg);
        }
      `}</style>
      <div
        className={`impostor-reveal-flip-card${visible ? " is-flipped" : ""}`}
        style={{ minHeight, cursor: "pointer", userSelect: "none" }}
        onClick={onToggle}
      >
        {/* Cara oculta: nuestro logo, "tocá para ver tu carta" */}
        <div
          className="impostor-reveal-flip-face"
          style={{
            ...S.card,
            position: "absolute",
            inset: 0,
            textAlign: "center",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.3))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img src={logo} alt="" style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 16, marginBottom: 14 }} />
          <p style={{ color: "var(--jt-muted-text)", fontSize: 15, fontWeight: 700 }}>Tocá para ver tu carta</p>
        </div>

        {/* Cara revelada */}
        <div
          className="impostor-reveal-flip-face impostor-reveal-flip-face-back"
          style={{
            ...S.card,
            textAlign: "center",
            background: "var(--jt-card-bg, rgba(255,255,255,0.04))",
            border: isImpostor ? "1px solid rgba(224,32,43,0.4)" : "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.3))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isImpostor ? (
            <p style={{ fontSize: 22, fontWeight: 800, color: "#F09595", margin: "0 0 4px" }}>¡Eres el impostor!</p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--jt-muted-text)", marginBottom: 6 }}>Tu palabra</p>
              <p style={S.bigReveal}>{word}</p>
            </>
          )}
          {isImpostor && hint && (
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", margin: "8px 0 0" }}>
              <span style={{ fontWeight: 800, color: "#e8e4f0" }}>Pista: </span>
              {hint}
            </p>
          )}
          {showCategory && (
            <p style={{ fontSize: 13, color: "var(--jt-muted-text)", margin: "8px 0 0" }}>
              <span style={{ fontWeight: 800, color: "#e8e4f0" }}>Categoría: </span>
              {categoryLabel}
            </p>
          )}
          <p style={{ fontSize: 12, color: "var(--jt-muted-text)", marginTop: 10 }}>Tocá para ocultar</p>
        </div>
      </div>
    </div>
  );
}
