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
      {shot.targetIsMe && <div className="shot-hurt" aria-hidden="true" />}
    </>
  );
}
