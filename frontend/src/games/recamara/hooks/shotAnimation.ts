import { useRef, useState } from "react";
import type { ShellKind } from "@juntada/recamara-engine";
import { ejectShellSpot, shortestGunAngle, type ShellSpot } from "../utils/arena";
import { AIM_MS, SHOT_MS } from "../utils/timing";

export type FireStage = "idle" | "aiming" | "firing" | "result";

// One empty casing lying on the table. `id` keys it so each one plays its
// own eject animation exactly once, when it's added.
export interface SpentShell extends ShellSpot {
  id: number;
  kind: ShellKind;
}

// Only the last casing stays on the table, so nobody can count how many
// shells have been fired: when a new one lands, the previous one is kept
// just long enough to fade out (see .spent-shell.fading) and then dropped.
export const MAX_SPENT_SHELLS = 2;

export interface ShotAnimation {
  fireStage: FireStage;
  // True while a shot is being staged — LocalGame/RoundView both fold this
  // into their own broader `busy` (which also covers item-use animations),
  // so it's exposed rather than hidden.
  busy: boolean;
  recoil: boolean;
  flash: boolean;
  gunAngle: number;
  // The casing that just landed last, preceded by the one fading out (if
  // any) — never more than MAX_SPENT_SHELLS.
  spentShells: SpentShell[];
  // For the "gun rests pointing away from whoever's turn it is" idle-aim
  // repositioning, and enterDuel's initial aim — anything that isn't an
  // actual shot being fired.
  setGunAngle: (next: number | ((prev: number) => number)) => void;
  // Points the gun at `targetAngle` (via the shortest path from wherever
  // it's currently resting — see shortestGunAngle) and plays the aim →
  // firing → result beats: the same aim-swing/recoil/muzzle-flash/shell-
  // eject sequence LocalGame and RoundView both need, just triggered from
  // different places (both through useEventDirector). Returns a cancel
  // function — call it from a useEffect's cleanup so an in-flight timeout
  // chain never fires after whatever triggered it goes stale.
  playShot: (targetAngle: number, shellKind: ShellKind) => () => void;
  // Called once the result banner is dismissed — back to idle/resting.
  finishShot: () => void;
  // recoil/flash only ever get set back to false here (or by the next
  // playShot) — call this right at the moment the duel arena (re)mounts,
  // so it can never paint either class already on and replay the
  // recoil/muzzle-flash animation with no shot actually fired. Leaves the
  // casings on the table alone.
  resetRecoilFlash: () => void;
  // Same, plus sweeps the casings off the table — call this on a reload
  // (new round), when the whole arena is about to visually reset.
  resetForNewRound: () => void;
}

export function useShotAnimation(): ShotAnimation {
  const [fireStage, setFireStage] = useState<FireStage>("idle");
  const [recoil, setRecoil] = useState(false);
  const [flash, setFlash] = useState(false);
  const [gunAngle, setGunAngle] = useState(0);
  const [spentShells, setSpentShells] = useState<SpentShell[]>([]);
  const nextShellId = useRef(1);
  // playShot reads the angle it just set, before React re-renders.
  const aimedAngle = useRef(0);

  const playShot = (targetAngle: number, shellKind: ShellKind): (() => void) => {
    setGunAngle(prev => {
      aimedAngle.current = shortestGunAngle(prev, targetAngle);
      return aimedAngle.current;
    });
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
      const id = nextShellId.current++;
      setSpentShells(prev => [...prev, { id, kind: shellKind, ...ejectShellSpot(aimedAngle.current) }].slice(-MAX_SPENT_SHELLS));
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
    resetRecoilFlash();
    setSpentShells([]);
  };

  return {
    fireStage,
    busy: fireStage !== "idle",
    recoil,
    flash,
    gunAngle,
    spentShells,
    setGunAngle,
    playShot,
    finishShot,
    resetRecoilFlash,
    resetForNewRound,
  };
}
