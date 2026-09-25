import type { FireStage } from "../hooks/shotAnimation";
import type { PlayingFx } from "../utils/playingFx";

// Full-screen beats of a shot, on top of everything: a white-hot flash on a
// live shell, plus a red vignette when that shell hit this device's player.
// Both only mount for the "firing" beat, so each shot replays them.
export function ShotEffects({ shot, fireStage }: { shot: PlayingFx | null; fireStage: FireStage }) {
  if (!shot || shot.kind !== "shot" || fireStage !== "firing" || shot.shellKind !== "live") return null;
  return (
    <>
      <div className="shot-flash" aria-hidden="true" />
      {shot.targetIsMe && (
        <div className="shot-hurt" aria-hidden="true">
          {/* The reference's cracks across the vignette. */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M0 18 L14 24 L9 33 L22 41 M100 70 L84 66 L88 56 L74 50 M70 0 L66 12 L76 17"
              stroke="rgba(255,255,255,.35)"
              strokeWidth=".5"
              fill="none"
            />
          </svg>
        </div>
      )}
    </>
  );
}
