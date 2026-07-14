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
