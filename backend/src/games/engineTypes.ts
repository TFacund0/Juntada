// ─── Game Engine Contract ────────────────────────────────────────────────────
// Mirrors the contract documented as a comment in registry.js. The engines
// themselves (games/*/engine.js) stay JS until each migrates individually —
// this is what callers cast getEngine(gameType)'s return to in the meantime,
// so every consumer of "some engine" shares one definition instead of each
// hand-rolling its own partial subset.

import type { Room } from "@juntada/shared-types";

export interface GameEngine {
  id: string;
  minPlayers?: number;
  maxPlayers?: number;
  createConfig(): Record<string, unknown>;
  startRound(room: Room): { success?: true; error?: string };
  maybeAdvance(room: Room): void;
  handleAction(
    room: Room,
    playerId: string,
    action: string,
    payload: Record<string, unknown>,
  ): { handled: boolean; [key: string]: unknown };
  getPublicRoundView(room: Room): unknown;
  getPrivateView(room: Room, playerId: string): Record<string, unknown> | null;
  getPhaseTimerEnd?(room: Room): number | null;
  forceReadyAndAdvance?(room: Room): void;
  getRevealMessage?(room: Room): ({ type: string } & Record<string, unknown>) | null;
  // Fires immediately when a player drops (see roomService.markOffline) —
  // unlike maybeAdvance (only re-run once they're actually removed, after
  // the 5-minute grace period, or on some other explicit action), this is
  // for low-stakes/reversible reactions only, like handing off a strict
  // turn rotation to the next online player. Anything that would exclude a
  // player from a vote/ready/confirm count belongs in maybeAdvance instead,
  // so a brief reconnect blip can't cost them their say.
  onPlayerOffline?(room: Room, playerId: string): void;
}
