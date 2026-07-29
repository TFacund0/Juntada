import { useState } from "react";
import type { ShellKind } from "@juntada/recamara-engine";
import { randomShellSpot, shortestGunAngle } from "../utils/arena";
import { AIM_MS, SHOT_MS } from "../utils/timing";

export type FireStage = "idle" | "aiming" | "firing" | "result";

export interface ShotAnimation {
  fireStage: FireStage;
  // True while a shot is being staged — LocalGame/RoundView both fold this
  // into their own broader `busy` (which also covers item-use animations),
  // so it's exposed rather than hidden.
  busy: boolean;
  recoil: boolean;
  flash: boolean;
  gunAngle: number;
  lastShell: ShellKind | null;
  shellSpot: { left: number; top: number; rot: number };
  shellPhase: "eject" | "landed";
  // For the "gun rests pointing away from whoever's turn it is" idle-aim
  // repositioning, and enterDuel's initial aim — anything that isn't an
  // actual shot being fired.
  setGunAngle: (next: number | ((prev: number) => number)) => void;
  // Points the gun at `targetAngle` (via the shortest path from wherever
  // it's currently resting — see shortestGunAngle) and plays the aim →
  // firing → result beats: the same aim-swing/recoil/muzzle-flash/shell-
  // eject sequence LocalGame and RoundView both need, just triggered from
  // different places (LocalGame calls this the instant a player taps a
  // target; RoundView calls it once a new pendingFire arrives from the
  // server). Returns a cancel function — call it from a useEffect's
  // cleanup so an in-flight timeout chain never fires after whatever
  // triggered it goes stale.
  playShot: (targetAngle: number, shellKind: ShellKind) => () => void;
  // Called once the result banner is dismissed — back to idle/resting.
  finishShot: () => void;
  // recoil/flash only ever get set back to false here (or by the next
  // playShot) — call this right at the moment the duel arena (re)mounts,
  // so it can never paint either class already on and replay the
  // recoil/muzzle-flash animation with no shot actually fired.
  resetRecoilFlash: () => void;
  // Same, plus clears the last-fired shell casing — call this on a reload
  // (new round), when the whole arena is about to visually reset.
  resetForNewRound: () => void;
}

export function useShotAnimation(): ShotAnimation {
  const [fireStage, setFireStage] = useState<FireStage>("idle");
  const [recoil, setRecoil] = useState(false);
  const [flash, setFlash] = useState(false);
  const [gunAngle, setGunAngle] = useState(0);
  const [lastShell, setLastShell] = useState<ShellKind | null>(null);
  const [shellSpot, setShellSpot] = useState({ left: 50, top: 50, rot: 0 });
  const [shellPhase, setShellPhase] = useState<"eject" | "landed">("eject");

  const playShot = (targetAngle: number, shellKind: ShellKind): (() => void) => {
    setGunAngle(prev => shortestGunAngle(prev, targetAngle));
    setFireStage("aiming");

    let resultTimeout: ReturnType<typeof setTimeout> | undefined;
    const aimTimeout = setTimeout(() => {
      setFireStage("firing");
      setRecoil(false);
      requestAnimationFrame(() => setRecoil(true));
      if (shellKind === "live") {
        setFlash(false);
        requestAnimationFrame(() => setFlash(true));
      }
      // Park the shell back at the gun first (so it visibly comes out of it
      // every time, even after a previous shot already landed somewhere),
      // then fly it out to a fresh spot on the next frame.
      setLastShell(shellKind);
      setShellPhase("eject");
      const spot = randomShellSpot();
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setShellSpot(spot);
          setShellPhase("landed");
        }),
      );
      resultTimeout = setTimeout(() => setFireStage("result"), SHOT_MS);
    }, AIM_MS);

    return () => {
      clearTimeout(aimTimeout);
      if (resultTimeout) clearTimeout(resultTimeout);
    };
  };

  const finishShot = () => setFireStage("idle");

  const resetRecoilFlash = () => {
    setRecoil(false);
    setFlash(false);
  };

  const resetForNewRound = () => {
    setRecoil(false);
    setFlash(false);
    setLastShell(null);
  };

  return {
    fireStage,
    busy: fireStage !== "idle",
    recoil,
    flash,
    gunAngle,
    lastShell,
    shellSpot,
    shellPhase,
    setGunAngle,
    playShot,
    finishShot,
    resetRecoilFlash,
    resetForNewRound,
  };
}
