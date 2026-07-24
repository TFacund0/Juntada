// ─── Snapshot Persistence ────────────────────────────────────────────────────
// Periodically dumps rooms/groups (see roomStore.ts) to Redis as one JSON
// blob, and restores them on boot. Everything else about the game keeps
// running 100% in-memory exactly as before — this only exists so an active
// game survives a process restart (a deploy, or Render's free-tier sleep),
// which otherwise wipes roomStore's Maps entirely.
//
// `clients` (live WebSocket -> player mapping) and `timers` (live
// setTimeout handles) are NOT part of the snapshot — they only make sense
// within the process that created them. Reconnecting sockets are already
// handled by the rejoin/rejoin_group message types, which this leans on:
// every restored player/member is marked offline until they actually
// reconnect.
//
// Same "off by default" shape as sentry.ts: every export here is a safe
// no-op unless REDIS_URL is set (see env.ts).

import type { Room, Group } from "@juntada/shared-types";
import type { Redis as RedisClient } from "ioredis";
import { env } from "../env";
import { logger } from "../logger";

const Redis = require("ioredis");
const { rooms, groups } = require("./roomStore") as { rooms: Map<string, Room>; groups: Map<string, Group> };
const roomService = require("../rooms/roomService");
const groupService = require("../rooms/groupService");
const { syncPhaseTimer } = require("../ws/shared");
const { getEngine } = require("../games/registry") as {
  getEngine: (gameType: string | null | undefined) => import("../games/engineTypes").GameEngine | undefined;
};

// Bumped only as a breadcrumb for whoever's debugging a restore issue later —
// nothing here actually branches on it yet (no migration framework), but
// logging a mismatch beats silently loading a shape a newer/older server
// might not fully understand. Each engine defends its own round shape via
// the optional migrateRound() hook instead of a real migration path.
const SCHEMA_VERSION = 1;

// Namespaced (see REDIS_NAMESPACE in env.ts) so staging and production can
// share one Redis database without one environment's restart restoring the
// other's rooms.
const SNAPSHOT_KEY = `${env.REDIS_NAMESPACE}:snapshot`;
// Bounds how long an abandoned deployment's snapshot lingers in Redis —
// this is a safety net for stale data, not a meaningful expectation for how
// long a game session should last.
const SNAPSHOT_TTL_SECONDS = 24 * 60 * 60;
const SNAPSHOT_INTERVAL_MS = 20_000;

let redis: RedisClient | null = null;
if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 }) as RedisClient;
  // ioredis treats an unhandled "error" event as fatal (crashes the
  // process) — listening here just means connection issues get logged
  // instead, since persistence is optional and shouldn't be able to take
  // the whole game server down.
  redis.on("error", (err: unknown) => logger.error({ err }, "redis connection error"));
}

const enabled = redis !== null;

async function saveSnapshot(): Promise<void> {
  if (!redis) return;
  const payload = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    rooms: [...rooms.entries()],
    groups: [...groups.entries()],
  });
  try {
    await redis.set(SNAPSHOT_KEY, payload, "EX", SNAPSHOT_TTL_SECONDS);
  } catch (err) {
    logger.error({ err }, "failed to save snapshot to redis");
  }
}

async function loadSnapshot(): Promise<void> {
  if (!redis) return;

  let raw: string | null;
  try {
    raw = await redis.get(SNAPSHOT_KEY);
  } catch (err) {
    logger.error({ err }, "failed to load snapshot from redis");
    return;
  }
  if (!raw) return;

  let data: { schemaVersion?: number; rooms: [string, Room][]; groups: [string, Group][] };
  try {
    data = JSON.parse(raw);
  } catch (err) {
    logger.error({ err }, "snapshot in redis is corrupt, ignoring");
    return;
  }

  if (data.schemaVersion !== SCHEMA_VERSION) {
    logger.warn(
      { snapshotVersion: data.schemaVersion, currentVersion: SCHEMA_VERSION },
      "restoring a snapshot saved by a different schema version — each engine's migrateRound() should backfill whatever it needs",
    );
  }

  // Nobody has a live socket yet right after a restart — every restored
  // player/member starts offline and reconnects (or doesn't) through the
  // existing rejoin/rejoin_group flow, exactly like a normal disconnect.
  for (const [code, room] of data.rooms) {
    room.players.forEach(p => {
      p.online = false;
    });
    rooms.set(code, room);
    // Backfills whatever fields that room's engine has added to its round
    // shape since this snapshot was saved — see migrateRound's own comment
    // (engineTypes.ts) for why this lives per-engine instead of a shared
    // migration framework.
    if (room.round) getEngine(room.gameType)?.migrateRound?.(room);
    // Every restored room is fully offline by construction (see above), so
    // this reuses the existing 5-minute grace-period reaper instead of
    // leaving abandoned restored rooms sitting around forever.
    roomService.scheduleRoomCleanup(code);
    // Engines store phase deadlines as absolute timestamps (Date.now() +
    // duration), not relative countdowns, so re-deriving the timer here
    // picks up correctly from real elapsed time — no "frozen timer" bug.
    if (room.round) syncPhaseTimer(room);
  }
  for (const [code, group] of data.groups) {
    group.members.forEach(m => {
      m.online = false;
    });
    groups.set(code, group);
    groupService.scheduleGroupCleanup(code);
  }

  logger.info({ rooms: rooms.size, groups: groups.size }, "restored snapshot from redis");
}

let snapshotInterval: NodeJS.Timeout | null = null;

function startSnapshotLoop(): void {
  if (!redis || snapshotInterval) return;
  snapshotInterval = setInterval(() => {
    saveSnapshot();
  }, SNAPSHOT_INTERVAL_MS);
  snapshotInterval.unref();
}

function stopSnapshotLoop(): void {
  if (snapshotInterval) {
    clearInterval(snapshotInterval);
    snapshotInterval = null;
  }
}

module.exports = { saveSnapshot, loadSnapshot, startSnapshotLoop, stopSnapshotLoop, enabled };
