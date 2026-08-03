// ─── Game Engine Contract ────────────────────────────────────────────────────
// Mirrors the contract documented as a comment in registry.ts. This is what
// getEngine(gameType)'s return type actually is, so every consumer of "some
// engine" shares one definition instead of each hand-rolling its own partial
// subset.

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
  // Fires once a player's been disconnected for about a minute straight
  // (see ws/shared.ts's scheduleOfflineReaction — not the instant they
  // drop, so a brief blip or answering a text doesn't cost them anything)
  // and they're still offline by then. Unlike maybeAdvance (only re-run
  // once they're actually removed, after the full 10-minute grace period, or
  // on some other explicit action), this is for low-stakes/reversible
  // reactions only, like handing off a strict turn rotation to the next
  // online player. Anything that would exclude a player from a vote/ready/
  // confirm count belongs in maybeAdvance instead, so a brief reconnect
  // blip can't cost them their say.
  onPlayerOffline?(room: Room, playerId: string): void;
  // Wipes this room's cross-round progress (score, round history) without
  // touching phase/round/ready — called by the shared "back_to_lobby"
  // handler so leaving to the lobby always starts the next match from zero,
  // the same way "new_game" does. Optional since not every game accrues
  // progress across rounds (e.g. a single-elimination bracket has nothing
  // meaningful to wipe here).
  resetProgress?(room: Room): void;
  // Backfills any round field that's missing on `room.round` because it was
  // persisted (Redis snapshot restore, see state/persistence.ts) by an older
  // version of this engine that didn't have that field yet — called once
  // right after a room is restored, so a stale shape never reaches game
  // logic at all instead of every engine having to defend against it
  // wherever it might get touched first. Optional since most engines'
  // round shape has stayed simple enough to never have needed this.
  migrateRound?(room: Room): void;
  // Overrides ws/roomHandlers.ts's default 10-minute auto-kick grace period
  // for a disconnected player, per-room/per-player — e.g. Impostor shortens
  // this while a vote is stuck waiting on them, since everyone else is
  // blocked in the meantime. Return undefined to fall back to the default.
  offlineKickTimeoutMs?(room: Room, playerId: string): number | undefined;
}
