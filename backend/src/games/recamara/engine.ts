// ─── Recámara — Game Engine (online) ────────────────────────────────────────
// Same duel as the local pass-and-play mode (frontend/src/games/recamara/
// LocalGame.tsx) — all the actual rules (shells, damage, turn order, items)
// come straight from @juntada/recamara-engine, shared verbatim with the
// client so nothing gets re-implemented or drifts between the two modes.
//
// Turn resolution is server-authoritative and instant: `fire`/`use_item`
// apply immediately and the new state broadcasts right away. Each client
// then plays its own local aim/recoil/banner animation off `pendingFire`/
// `lastItemEvent` (each carries a monotonic `seq`) before it lets the
// player see the new turn — see RoundView.tsx's seq-diffing effect. That
// buffering is purely a client concern; nothing here waits on it.
//
// The engine's Player.id is a small number (0..n-1, assigned by
// createInitialState in seat order) — `seatOrder` maps that back to this
// room's actual player ids so actions/messages can use real player ids.
//
// Beyond the shell order (already hidden the same way local pass-and-play
// hides it), the one other secret here is 📞's actual hint — unlike local
// mode (one shared screen, nothing to hide from anyone at the table),
// online keeps that private to whoever called; see getPrivateView and
// lastPhoneHint below. Everything else — items, the "each player opens
// their own chest at their own pace" reveal — is purely public/client-side
// animation over already-public data (see ChestReveal usage in
// RoundView.tsx), gated by the `ready_for_duel` action once a player's done
// looking.

import type { Room } from "@juntada/shared-types";
import { escapeHtml } from "@juntada/core-utils";
import type { GameEngine } from "../engineTypes";
import {
  canUseItem,
  createInitialState,
  describeFireResult,
  describeItemResult,
  describeSkippedTurn,
  fireShot,
  ITEM_POOL,
  ITEMS_PER_RELOAD,
  useItem,
  type GameState,
  type ItemKind,
  type LastItemEvent,
  type LogLine,
  type PendingFire,
  type Player,
  type RecamaraRoundView,
  type ShellKind,
} from "@juntada/recamara-engine";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

// PendingFire/LastItemEvent come straight from @juntada/recamara-engine —
// same shapes RoundView.tsx reads, so a field rename here can't silently
// desync from what the client expects (see that package's "online wire
// types" section). `state` stays the *real*, non-sanitized GameState on
// this internal round record — RecamaraRoundView (also shared) is only the
// shape getPublicRoundView actually sends, with shells stripped there.
interface RecamaraRound {
  seatOrder: string[]; // room player id at each engine-numeric-id index
  state: GameState;
  subPhase: "reveal" | "duel";
  roundNumber: number;
  readyForDuel: string[]; // room player ids who've confirmed they saw their new items
  shotSeq: number;
  itemSeq: number;
  pendingFire: PendingFire | null;
  lastItemEvent: LastItemEvent | null;
  log: LogLine[];
  winnerRoomId: string | null;
  // 📞's real hint — kept off RecamaraRoundView/lastItemEvent entirely so it
  // never reaches anyone but the player who called; getPrivateView below
  // only ever hands it back to forPlayerId, matched by seq to lastItemEvent
  // so a stale hint from an earlier call can't get mistaken for a new one.
  lastPhoneHint: { forPlayerId: string; seq: number; positionFromNow: number; shellKind: ShellKind } | null;
  // 🔍's real reveal — same privacy treatment as lastPhoneHint above: kept
  // off RecamaraRoundView/lastItemEvent entirely so it never reaches anyone
  // but the player who called; getPrivateView only ever hands it back to
  // forPlayerId, matched by seq to lastItemEvent.
  lastLupaHint: { forPlayerId: string; seq: number; shellKind: ShellKind } | null;
}

function round(room: Room): RecamaraRound {
  return room.round as RecamaraRound;
}

function roomIdFor(r: RecamaraRound, engineId: number | null | undefined): string | null {
  if (engineId == null) return null;
  return r.seatOrder[engineId] ?? null;
}

function addLog(r: RecamaraRound, line: LogLine): void {
  r.log.push(line);
  if (r.log.length > 8) r.log.shift();
}

// describeFireResult/describeItemResult (shared engine) take a name
// resolver rather than searching a Player[] themselves — same resolver
// shape LocalGame.tsx uses, since this engine's ids are the same numeric
// ones (log text embeds names, not room ids).
function nameOf(players: Player[]): (id: number) => string {
  return id => escapeHtml(players.find(p => p.id === id)?.name ?? "?");
}

function createConfig(): Record<string, unknown> {
  return {};
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  if (room.players.length > MAX_PLAYERS) return { error: `Como máximo ${MAX_PLAYERS} jugadores` };

  const seatOrder = room.players.map(p => p.id);
  const state = createInitialState(room.players.map(p => p.name));

  const r: RecamaraRound = {
    seatOrder,
    state,
    subPhase: "reveal",
    roundNumber: 1,
    readyForDuel: [],
    shotSeq: 0,
    itemSeq: 0,
    pendingFire: null,
    lastItemEvent: null,
    log: [],
    winnerRoomId: null,
    lastPhoneHint: null,
    lastLupaHint: null,
  };
  addLog(r, { text: `Se cargó la recámara. Empieza <b>${escapeHtml(state.players[0].name)}</b>.` });

  room.round = r;
  room.phase = "playing";
  return { success: true };
}

// No timed phases and every action resolves synchronously — nothing to
// auto-advance on a tick. Kept only to satisfy the GameEngine contract.
function maybeAdvance(_room: Room): void {}

function fire(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean } {
  const r = round(room);
  if (r.subPhase !== "duel") return { handled: false };

  const currentEngineId = r.state.order[r.state.turnPos];
  if (roomIdFor(r, currentEngineId) !== playerId) return { handled: false };

  const targetRoomId = payload.targetId;
  if (typeof targetRoomId !== "string") return { handled: false };
  const targetEngineId = r.seatOrder.indexOf(targetRoomId);
  if (targetEngineId === -1) return { handled: false };

  const playersBefore: Player[] = r.state.players;
  const result = fireShot(r.state, targetEngineId);
  r.state = result.state;
  r.shotSeq += 1;
  r.pendingFire = {
    seq: r.shotSeq,
    shooterId: playerId,
    targetId: targetRoomId,
    shellKind: result.shellKind,
    damage: result.damage,
    gameOver: result.gameOver,
    winnerId: roomIdFor(r, result.winner?.id),
    reloaded: result.reloaded,
    skippedIds: result.skippedIds.map(id => roomIdFor(r, id)).filter((id): id is string => id != null),
  };
  addLog(r, describeFireResult(result, nameOf(playersBefore)));
  result.skippedIds.forEach(id => addLog(r, describeSkippedTurn(id, nameOf(playersBefore))));

  if (result.gameOver) {
    r.winnerRoomId = r.pendingFire.winnerId;
    room.phase = "result";
  } else if (result.reloaded) {
    addLog(r, { text: `Recámara vacía — se recarga y cada jugador recibe <b>${ITEMS_PER_RELOAD} ítems</b> nuevos.` });
    r.subPhase = "reveal";
    r.roundNumber += 1;
    r.readyForDuel = [];
  }
  return { handled: true };
}

function useItemAction(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: boolean } {
  const r = round(room);
  if (r.subPhase !== "duel") return { handled: false };

  const currentEngineId = r.state.order[r.state.turnPos];
  if (roomIdFor(r, currentEngineId) !== playerId) return { handled: false };

  const item = payload.item;
  if (typeof item !== "string" || !(ITEM_POOL as readonly string[]).includes(item)) return { handled: false };
  // Holding it, and a second 🧤 in the same turn — see canUseItem.
  if (!canUseItem(r.state, item as ItemKind)) return { handled: false };

  const targetRoomId = payload.targetId;
  const stolenItem = payload.stolenItem;
  let options: { targetId?: number; stolenItem?: ItemKind } | undefined;
  if (typeof targetRoomId === "string") {
    const targetEngineId = r.seatOrder.indexOf(targetRoomId);
    if (targetEngineId === -1) return { handled: false };
    options = { targetId: targetEngineId, stolenItem: typeof stolenItem === "string" ? (stolenItem as ItemKind) : undefined };
  }

  const playersBefore: Player[] = r.state.players;
  const result = useItem(r.state, item as ItemKind, options);
  r.state = result.state;
  r.itemSeq += 1;
  r.lastItemEvent = {
    seq: r.itemSeq,
    playerId,
    item: result.item,
    // Never the real content — see this round's lastLupaHint comment.
    revealedShellKind: undefined,
    healedTo: result.healedTo,
    victimId: result.victimId === undefined ? undefined : roomIdFor(r, result.victimId),
    stolenItem: result.stolenItem,
    // Never the real content — see this round's lastPhoneHint comment.
    phoneHint: undefined,
    cuffedId: result.cuffedId === undefined ? undefined : roomIdFor(r, result.cuffedId),
  };
  r.lastPhoneHint = item === "📞" && result.phoneHint ? { forPlayerId: playerId, seq: r.itemSeq, ...result.phoneHint } : null;
  r.lastLupaHint =
    item === "🔍" && result.revealedShellKind ? { forPlayerId: playerId, seq: r.itemSeq, shellKind: result.revealedShellKind } : null;
  addLog(r, describeItemResult(result, nameOf(playersBefore), { revealPhoneHint: false, revealLupaHint: false }));
  return { handled: true, rerolled: item === "📞" || item === "🔍" };
}

function readyForDuel(room: Room, playerId: string): { handled: boolean } {
  const r = round(room);
  if (r.subPhase !== "reveal") return { handled: false };
  if (!r.seatOrder.includes(playerId)) return { handled: false };
  if (!r.readyForDuel.includes(playerId)) r.readyForDuel.push(playerId);
  // Eliminated players are spectators now — nothing left for them to see
  // in the reveal (no new items, see @juntada/recamara-engine's
  // reloadIfNeeded), so the duel must never wait on them to confirm.
  const aliveRoomIds = r.state.players.filter(p => p.lives > 0).map(p => r.seatOrder[p.id]);
  if (aliveRoomIds.every(id => r.readyForDuel.includes(id))) {
    r.subPhase = "duel";
    r.readyForDuel = [];
  }
  return { handled: true };
}

function handleAction(room: Room, playerId: string, action: string, payload: Record<string, unknown>): { handled: boolean } {
  if (!room.round || room.phase !== "playing") return { handled: false };
  switch (action) {
    case "fire":
      return fire(room, playerId, payload);
    case "use_item":
      return useItemAction(room, playerId, payload);
    case "ready_for_duel":
      return readyForDuel(room, playerId);
    default:
      return { handled: false };
  }
}

// Typed as the shared RecamaraRoundView (not a loose Record<string,
// unknown>) so this is checked at compile time against the exact shape
// RoundView.tsx casts room.round to — a field added/renamed on either side
// without the other now fails the build instead of only failing at runtime.
function getPublicRoundView(room: Room): RecamaraRoundView | null {
  if (!room.round) return null;
  const r = round(room);
  // The shell *order* is the one real secret in this game — strip the kind
  // of anything not already revealed (by a shot, or lupa/teléfono) so a
  // modified client can't just read it off the wire. The aggregate real/
  // falso split for the whole chamber was always meant to be public
  // (same as local mode's reveal screen), so it's sent separately here
  // rather than derived from the (now-stripped) per-shell kinds.
  const shells = r.state.shells.map(s => (s.revealed ? s : { ...s, kind: null }));
  const liveCount = r.state.shells.filter(s => s.kind === "live").length;
  return {
    seatOrder: r.seatOrder,
    state: { ...r.state, shells },
    liveCount,
    blankCount: r.state.shells.length - liveCount,
    subPhase: r.subPhase,
    roundNumber: r.roundNumber,
    readyForDuel: r.readyForDuel,
    pendingFire: r.pendingFire,
    lastItemEvent: r.lastItemEvent,
    log: r.log,
    winnerRoomId: r.winnerRoomId,
  };
}

// The things this game keeps genuinely private per-player: 📞's real hint
// and 🔍's real reveal, sent only to whoever called (see lastPhoneHint/
// lastLupaHint on RecamaraRound). Matched by seq on the client side against
// the (redacted) lastItemEvent, so an old hint can never get displayed as
// if it belonged to a new call.
function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  const phoneHint =
    r.lastPhoneHint && r.lastPhoneHint.forPlayerId === playerId
      ? { seq: r.lastPhoneHint.seq, positionFromNow: r.lastPhoneHint.positionFromNow, shellKind: r.lastPhoneHint.shellKind }
      : undefined;
  const lupaHint =
    r.lastLupaHint && r.lastLupaHint.forPlayerId === playerId
      ? { seq: r.lastLupaHint.seq, shellKind: r.lastLupaHint.shellKind }
      : undefined;
  if (!phoneHint && !lupaHint) return null;
  return { phoneHint, lupaHint };
}

const engine: GameEngine = {
  id: "recamara",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
};

module.exports = engine;
