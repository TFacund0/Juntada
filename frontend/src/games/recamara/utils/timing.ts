import type { ItemKind } from "@juntada/recamara-engine";

// Animation pacing shared by LocalGame and RoundView — kept in one place so
// local and online play out at identical speed instead of two constants
// silently drifting apart.

// How long the gun takes to swing onto its target before firing, and how
// long the recoil/flash itself lasts — slow and deliberate on purpose, so
// there's real suspense in watching the gun turn and go off before the
// result banner appears.
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
// The reload sequence on the round overlay (see ReloadSequence): shells
// pop in one by one, hold so the table can memorize the split, flip
// face-down, shuffle, then load into the gun one by one.
export const RELOAD_SHELL_IN_MS = 110;
export const RELOAD_HOLD_MS = 2200;
export const RELOAD_FLIP_MS = 320;
export const RELOAD_SHUFFLE_MS = 1040;
export const RELOAD_SHELL_LOAD_MS = 200;
// The round overlay (see RoundOverlay): the "RONDA N" title settles in
// before the shells start, and the overlay lingers a beat after the last
// shell is loaded before it lifts off the table.
export const ROUND_TITLE_MS = 600;
export const ROUND_OUTRO_MS = 450;
// The result banner (see ResultBanner): taps within the first
// BANNER_TAP_GUARD_MS are ignored (so the tap that fired doesn't also skip
// its own result), and it moves on by itself after BANNER_AUTO_MS.
export const BANNER_TAP_GUARD_MS = 350;
export const BANNER_AUTO_MS = 2600;
