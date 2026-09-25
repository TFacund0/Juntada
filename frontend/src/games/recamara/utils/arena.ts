// Pure geometry for the circular arena — shared by LocalGame.tsx (local
// pass-and-play) and RoundView.tsx (online), so the seat layout and the
// "gun points at whoever's turn it is" / "shell lands somewhere near the
// gun" behavior can never drift between the two modes.

// Seat around the arena circle — index 0 sits at the top, the rest follow
// clockwise. Seats are assigned once (state.order never reshuffles), so a
// player keeps the same spot even after they're eliminated.
export function seatAngle(order: number[], playerId: number): number {
  const i = order.indexOf(playerId);
  return -90 + (360 / order.length) * i;
}

// Where a seat sits on the table, as a point near its rim. The card that
// stands there is anchored by its bottom edge and counter-rotated against
// the table's tilt in CSS (see .seat in arena.css), not here.
export function seatStyle(order: number[], playerId: number) {
  const rad = (seatAngle(order, playerId) * Math.PI) / 180;
  const r = 40;
  return {
    left: `${50 + r * Math.cos(rad)}%`,
    top: `${50 + r * Math.sin(rad)}%`,
  };
}

// The gun's resting orientation while it's someone's turn: pointing away
// from their own seat (roughly "at whoever's across the table"), never at
// themselves — aiming at a specific target only happens once they actually
// choose who to shoot.
export function frontAngle(order: number[], playerId: number): number {
  return seatAngle(order, playerId) + 180;
}

// gunAngle is stored as a plain, ever-growing/shrinking degree number (not
// wrapped to 0-360) precisely so the CSS `rotate()` transition on .gun-aim
// can animate it directly — but every new target from seatAngle/frontAngle
// comes back in a fixed -90..270 range, and jumping from e.g. -80deg to
// 260deg would spin the *long* way round (340deg) instead of the 20deg it
// actually needs. This nudges the target by whole 360deg turns until it's
// within half a turn of wherever the gun currently is, so the CSS
// transition always takes the shortest visible path — the same target
// angle, mod 360, just picked to be near `current` instead of always in
// seatAngle's raw range.
export function shortestGunAngle(current: number, target: number): number {
  let next = target;
  while (next - current > 180) next -= 360;
  while (next - current < -180) next += 360;
  return next;
}

// Where a spent shell lands after a shot: thrown out of the ejection port,
// roughly perpendicular to wherever the gun is pointing (the reference's
// "gunAngle + 90° ± 25°"), a short distance from the center — beside the
// gun instead of under it. `rot` is how much it tumbles on the way down
// (see .spent-shell in effects.css).
export interface ShellSpot {
  left: number;
  top: number;
  rot: number;
}

export function ejectShellSpot(gunAngle: number, rand: () => number = Math.random): ShellSpot {
  const angle = gunAngle + 90 + (rand() - 0.5) * 50;
  const radius = 16 + rand() * 10; // 16%..26% from the table's center
  const rad = (angle * Math.PI) / 180;
  return {
    left: 50 + radius * Math.cos(rad),
    top: 50 + radius * Math.sin(rad),
    rot: Math.floor(rand() * 721) - 360,
  };
}
