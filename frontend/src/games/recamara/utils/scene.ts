import type { Player } from "@juntada/recamara-engine";
import type { FireStage } from "../hooks/shotAnimation";
import type { PlayingFx } from "./playingFx";

// Small pure helpers behind DuelScene, shared by LocalGame and RoundView.

// Shells still loaded, as the chamber strip shows them. The state on screen
// is the pre-shot one until the banner is dismissed, so the shot being
// played is taken out as soon as its trigger is pulled — its mini shell
// drops right when the gun goes off, like the reference's popMini().
export function shellsLeft(shells: { spent: boolean }[], playing: PlayingFx | null, fireStage: FireStage): number {
  const loaded = shells.filter(s => !s.spent).length;
  const fired = playing?.kind === "shot" && (fireStage === "firing" || fireStage === "result") ? 1 : 0;
  return Math.max(0, loaded - fired);
}

// Who the shot being played is aimed at, for the status line.
export function aimingAt(shot: PlayingFx, players: Player[], shooterId: number, meId?: number) {
  return {
    targetName: players.find(p => p.id === shot.targetId)?.name ?? "",
    targetIsMe: meId != null && shot.targetId === meId,
    targetIsShooter: shot.targetId === shooterId,
  };
}
