import type { GameDef } from "./gameTypes";

// Games flagged `maintenance: true` stay blocked in production. Setting
// VITE_DISABLE_MAINTENANCE_GATE=true (only on the staging Render service's
// own env vars, never committed) lifts the gate there so everything stays
// testable while working against staging, without touching this file per
// deploy.
export function isUnderMaintenance(game: Pick<GameDef, "maintenance">): boolean {
  if (import.meta.env.VITE_DISABLE_MAINTENANCE_GATE === "true") return false;
  return !!game.maintenance;
}

// Whether a game can actually be picked/played right now — not just
// implemented, but not hidden behind a "próximamente" placeholder nor
// gated by the maintenance flag above. Centralizes a check repeated across
// App.tsx/useAppNavigation.ts/useMultiplayerGameShell.ts so all three agree
// on what "available" means without copy-pasting the same two negations.
export function isGameAvailable(game: Pick<GameDef, "comingSoon" | "maintenance">): boolean {
  return !game.comingSoon && !isUnderMaintenance(game);
}
