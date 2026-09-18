import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
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
        className={clsx("impostor-reveal-flip-card cursor-pointer select-none", visible && "is-flipped")}
        style={{ minHeight }}
        onClick={onToggle}
      >
        {/* Cara oculta: nuestro logo, "tocá para ver tu carta" */}
        <div className={clsx("impostor-reveal-flip-face", T.card, T.flipFaceFront)}>
          <img src={logo} alt="" className={T.flipLogoImg} />
          <p className={T.flipHintLabel}>Tocá para ver tu carta</p>
        </div>

        {/* Cara revelada */}
        <div className={clsx("impostor-reveal-flip-face impostor-reveal-flip-face-back", T.card, T.flipFaceBack(isImpostor))}>
          {isImpostor ? (
            <p className={T.flipRoleTitle}>¡Eres el impostor!</p>
          ) : (
            <>
              <p className={T.flipSubLabel}>Tu palabra</p>
              <p className={T.bigReveal}>{word}</p>
            </>
          )}
          {isImpostor && hint && (
            <p className={T.flipMetaLine}>
              <span className={T.flipMetaLineLabel}>Pista: </span>
              {hint}
            </p>
          )}
          {showCategory && (
            <p className={T.flipMetaLine}>
              <span className={T.flipMetaLineLabel}>Categoría: </span>
              {categoryLabel}
            </p>
          )}
          <p className={T.flipFooterHint}>Tocá para ocultar</p>
        </div>
      </div>
    </div>
  );
}
