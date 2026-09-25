import type { ItemKind } from "@juntada/recamara-engine";

// Animation pacing shared by LocalGame and RoundView — kept in one place so
// local and online play out at identical speed instead of two constants
// silently drifting apart.

// How long the gun takes to swing onto its target before firing, and how
// long the recoil/flash itself lasts — slow and deliberate on purpose, so
// there's real suspense in watching the gun turn and go off before the
// result banner appears (which then waits for a tap, not a timer).
export const AIM_MS = 1365; // 5% slower than the gun's original 1300ms swing
export const SHOT_MS = 550;
// How long an item's activation animation plays before its result banner
// shows up. Items with their own effect (see ItemEffect) take as long as
// that effect needs; the rest keep the short icon pulse.
export const ITEM_ACTIVATE_MS = 550;
const ITEM_FX_MS: Partial<Record<ItemKind, number>> = { "🪚": 1500, "🔍": 1900, "🚬": 1500 };
export function itemFxMs(item: ItemKind): number {
  return ITEM_FX_MS[item] ?? ITEM_ACTIVATE_MS;
}
// The reload sequence on the chamber card (see ReloadSequence): shells pop
// in one by one, hold so the table can memorize the split, flip face-down,
// shuffle, then load into the gun one by one. Kept under ROUND_INTRO_MS so
// it always finishes before the card moves on by itself.
export const RELOAD_SHELL_IN_MS = 110;
export const RELOAD_HOLD_MS = 1500;
export const RELOAD_FLIP_MS = 320;
export const RELOAD_SHUFFLE_MS = 750;
export const RELOAD_SHELL_LOAD_MS = 130;
// How long the chamber card (gun + real/falso shell count) stays up before
// moving on by itself — long enough for everyone at the table to actually
// read it, not just flash by.
export const ROUND_INTRO_MS = 5000;
// The themed "A disparar" flash (see FlashOverlay/useDuelEntryFlash) that
// bridges the reveal's last beat into the actual duel.
export const DUEL_TRANSITION_MS = 800;
// The plain "Ronda N" announcement (no items, no gun yet) — short on
// purpose, just long enough to register before moving on to items.
export const ROUND_ANNOUNCE_MS = 1800;
// How long the "Ronda N terminada" beat holds before crossfading into the
// next round's number — only shown when there was a previous round to close
// out (never on the very first round of a game).
export const ROUND_END_MS = 1300;
