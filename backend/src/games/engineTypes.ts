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
}
