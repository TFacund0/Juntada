// Animation pacing shared by LocalGame and RoundView — kept in one place so
// local and online play out at identical speed instead of two constants
// silently drifting apart.

// How long the gun takes to swing onto its target before firing, and how
// long the recoil/flash itself lasts — slow and deliberate on purpose, so
// there's real suspense in watching the gun turn and go off before the
// result banner appears (which then waits for a tap, not a timer).
export const AIM_MS = 1300;
export const SHOT_MS = 550;
// How long an item's activation animation (icon pulse) plays before its
// result banner shows up.
export const ITEM_ACTIVATE_MS = 550;
// How long the chamber card (gun + real/falso shell count) stays up before
// moving on by itself — long enough for everyone at the table to actually
// read it, not just flash by.
export const ROUND_INTRO_MS = 5000;
// The plain "Ronda N" announcement (no items, no gun yet) — short on
// purpose, just long enough to register before moving on to items.
export const ROUND_ANNOUNCE_MS = 1800;
// How long the "Ronda N terminada" beat holds before crossfading into the
// next round's number — only shown when there was a previous round to close
// out (never on the very first round of a game).
export const ROUND_END_MS = 1300;
