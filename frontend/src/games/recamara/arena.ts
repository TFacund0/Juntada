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

export function seatStyle(order: number[], playerId: number) {
  const rad = (seatAngle(order, playerId) * Math.PI) / 180;
  const r = 38;
  return {
    left: `${50 + r * Math.cos(rad)}%`,
    top: `${50 + r * Math.sin(rad)}%`,
    transform: "translate(-50%, -50%)",
  };
}

// The gun's resting orientation while it's someone's turn: pointing away
// from their own seat (roughly "at whoever's across the table"), never at
// themselves — aiming at a specific target only happens once they actually
// choose who to shoot.
export function frontAngle(order: number[], playerId: number): number {
  return seatAngle(order, playerId) + 180;
}

// A shuffled row of 🔴/🟡 standing in for the chamber's real/falso split on
// the round-intro card — never grouped ("all the reds first"), since even
// though the count itself is public info the *order* still shouldn't read
// as meaningful (the real shell order stays secret regardless).
export function shuffledBulletIcons(liveCount: number, blankCount: number): string[] {
  const icons = [...Array(liveCount).fill("🔴"), ...Array(blankCount).fill("🟡")];
  for (let i = icons.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [icons[i], icons[j]] = [icons[j], icons[i]];
  }
  return icons;
}

// Where the spent shell lands after a shot — somewhere different around the
// table each time, close to the gun but never exactly on top of it (hence
// the minimum radius) and never far off either (hence the small max).
export function randomShellSpot(): { left: number; top: number; rot: number } {
  const angle = Math.random() * 360;
  const radius = 16 + Math.random() * 10; // 16%..26% from the arena's center
  const rad = (angle * Math.PI) / 180;
  return {
    left: 50 + radius * Math.cos(rad),
    top: 50 + radius * Math.sin(rad),
    rot: Math.floor(Math.random() * 361) - 180,
  };
}
