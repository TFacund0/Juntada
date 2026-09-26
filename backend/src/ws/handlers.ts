// ─── WS Message Handlers ────────────────────────────────────────────────────
// Aggregates every message type into one dispatch table, plus the handlers
// that are genuinely cross-cutting between a room and its group (transferHost,
// handleDisconnect — both need to touch whichever of the two the sender is
// currently in). Standalone-room handlers live in roomHandlers.ts,
// group/instance handlers in groupHandlers.ts, and helpers both share in
// shared.ts. No game rules live in any of these — those go through the
// engine registered for the room's gameType.

import type { Room, Group, ClientMessage, ClientMessageType } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import { logger } from "../logger";

type WS = import("ws").WebSocket;

const { rooms, groups, clients, activeSockets } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
  clients: Map<WS, ClientInfo>;
  activeSockets: Map<string, WS>;
};
const roomService = require("../rooms/roomService");
const groupService = require("../rooms/groupService");
const { sendTo, broadcastState, broadcastGroupState, broadcastRoundReveal } = require("./messaging");
const { syncPhaseTimer, scheduleOfflineReaction } = require("./shared");
const roomHandlers = require("./roomHandlers");
const groupHandlers = require("./groupHandlers");

// Lets the current host hand the role to someone else — e.g. so another
// player can configure the next round. Works both inside an active room
// (game lobby/round) and on the group screen itself (no instance open),
// picking whichever context the sender is actually in.
function transferHost(ws: WS, msg: Extract<ClientMessage, { type: "transfer_host" }>, info: ClientInfo): void {
  if (info.roomCode) {
    const room = rooms.get(info.roomCode);
    if (!room || room.hostId !== info.playerId) return;
    if (!room.players.some(p => p.id === msg.targetId)) return;
    room.hostId = msg.targetId;
    logger.info({ roomCode: room.code, targetId: msg.targetId, byHostId: info.playerId }, "host transferred");
    broadcastState(room);
    return;
  }
  if (info.groupCode) {
    const group = groups.get(info.groupCode);
    if (!group || group.hostId !== info.playerId) return;
    if (!group.members.some(m => m.id === msg.targetId)) return;
    group.hostId = msg.targetId;
    logger.info({ groupCode: group.code, targetId: msg.targetId, byHostId: info.playerId }, "group host transferred");
    broadcastGroupState(group);
  }
}

function ping(ws: WS): void {
  sendTo(ws, { type: "pong" });
}

function handleDisconnect(ws: WS): void {
  const info = clients.get(ws);
  // A player who reconnected on a brand-new socket before this (older) one's
  // close event got around to firing already has activeSockets pointing at
  // that newer socket — treating this stale close as a real disconnect would
  // immediately mark them offline again right after they just came back,
  // silently dropping them out of any "every online player" gate. Only the
  // socket that currently owns the playerId gets to report it as gone.
  if (info?.playerId && activeSockets.get(info.playerId) !== ws) {
    clients.delete(ws);
    return;
  }
  if (info?.roomCode && info.playerId) {
    const room = rooms.get(info.roomCode);
    if (room) {
      logger.debug({ roomCode: room.code, playerId: info.playerId }, "player disconnected");
      roomService.markOffline(room, info.playerId);
      broadcastState(room);
      if (room.phase === "result") broadcastRoundReveal(room);
      if (room.round) syncPhaseTimer(room);
      // Gives them a real minute to reconnect on their own (bad signal, or
      // just answering a text) before a game's own onPlayerOffline reaction
      // (e.g. skipping whoever's turn it is) treats this as a real absence
      // — see scheduleOfflineReaction's own comment for why that's not
      // instant.
      if (room.round) scheduleOfflineReaction(room.code, info.playerId);
      // A group instance getting the same reap-after-5-minutes treatment as
      // a standalone room (instead of being skipped) matters: schedulePlayerKick
      // itself bails out when the whole room is already offline (on the
      // assumption that whole-room cleanup handles it — see its own
      // comment), and scheduleGroupCleanup only ever deletes the *group*,
      // never sweeps `rooms` for that group's now-abandoned instances. Group
      // membership state (getGroupPublicState) already derives `instances`
      // live from `rooms`, so deleting the room here is enough to make it
      // disappear from the group's instance list too — same as the
      // server-restart snapshot restore path (persistence.ts) already does
      // unconditionally, regardless of groupCode.
      if (roomService.isRoomFullyOffline(room)) roomService.scheduleRoomCleanup(room.code);
      else roomHandlers.schedulePlayerKick(room.code, info.playerId);
    }
  }
  if (info?.groupCode && info.playerId) {
    const group = groups.get(info.groupCode);
    if (group) {
      groupService.markMemberOffline(group, info.playerId);
      broadcastGroupState(group);
      if (groupService.isGroupFullyOffline(group)) groupService.scheduleGroupCleanup(group.code);
      else groupHandlers.scheduleGroupMemberKick(group.code, info.playerId);
    }
  }
  clients.delete(ws);
}

type Handler = (ws: WS, msg: ClientMessage, info: ClientInfo) => void | Promise<void>;

// Message type -> handler(ws, msg, info). Keyed by ClientMessageType (the
// same SCHEMAS-derived union validateMessage checks every incoming message
// against, see @juntada/shared-types) instead of a bare string, so a typo'd
// key or a message type missing its handler is a build error here instead
// of a silent no-op the first time a real client sends it.
const HANDLERS: Record<ClientMessageType, Handler> = {
  // create_room/join_room/create_group/join_group resolve the account's
  // current username via authService.getSelf (see roomHandlers.ts/
  // groupHandlers.ts) — async, unlike almost every other handler here. The
  // dispatch call site in server.ts awaits/handles the returned promise
  // generically for every handler, sync or async.
  create_room: (ws, msg, info) => roomHandlers.createRoom(ws, msg, info),
  join_room: (ws, msg, info) => roomHandlers.joinRoom(ws, msg, info),
  check_room_code: (ws, msg) => roomHandlers.checkRoomCode(ws, msg),
  rejoin: (ws, msg, info) => roomHandlers.rejoin(ws, msg, info),
  create_group: (ws, msg, info) => groupHandlers.createGroup(ws, msg, info),
  join_group: (ws, msg, info) => groupHandlers.joinGroup(ws, msg, info),
  rejoin_group: (ws, msg, info) => groupHandlers.rejoinGroup(ws, msg, info),
  create_instance: groupHandlers.createInstance,
  join_instance: groupHandlers.joinInstance,
  leave_instance: groupHandlers.leaveInstance,
  leave_group: groupHandlers.leaveGroup,
  update_config: roomHandlers.updateConfig,
  start_round: roomHandlers.startRoundHandler,
  submit_clue: roomHandlers.gameAction("submit_clue"),
  player_ready: roomHandlers.gameAction("player_ready"),
  vote: roomHandlers.gameAction("vote"),
  skip_word: roomHandlers.gameAction("skip_word"),
  cancel_skip_word: roomHandlers.gameAction("cancel_skip_word"),
  continue_round: roomHandlers.gameAction("continue_round"),
  send_chat_message: roomHandlers.gameAction("send_chat_message"),
  send_room_chat: roomHandlers.sendRoomChat,
  send_group_chat: groupHandlers.sendGroupChat,
  submit_guess: roomHandlers.gameAction("submit_guess"),
  confirm_round_setup: roomHandlers.gameAction("confirm_round_setup"),
  submit_spectrum: roomHandlers.gameAction("submit_spectrum"),
  new_game: roomHandlers.gameAction("new_game"),
  force_finish_round: roomHandlers.gameAction("force_finish_round"),
  report_result: roomHandlers.gameAction("report_result"),
  mark: roomHandlers.gameAction("mark"),
  reset_score_vote: roomHandlers.gameAction("reset_score_vote"),
  cancel_score_reset: roomHandlers.gameAction("cancel_score_reset"),
  confirm_letter: roomHandlers.gameAction("confirm_letter"),
  submit_answers: roomHandlers.gameAction("submit_answers"),
  call_basta: roomHandlers.gameAction("call_basta"),
  mark_word: roomHandlers.gameAction("mark_word"),
  confirm_review: roomHandlers.gameAction("confirm_review"),
  reveal: roomHandlers.gameAction("reveal"),
  assign: roomHandlers.gameAction("assign"),
  vote_end: roomHandlers.gameAction("vote_end"),
  spin: roomHandlers.gameAction("spin"),
  confirm_eliminate: roomHandlers.gameAction("confirm_eliminate"),
  spin_again: roomHandlers.gameAction("spin_again"),
  choose_word: roomHandlers.gameAction("choose_word"),
  draw_stroke: roomHandlers.gameAction("draw_stroke"),
  draw_fill: roomHandlers.gameAction("draw_fill"),
  draw_clear: roomHandlers.gameAction("draw_clear"),
  draw_undo: roomHandlers.gameAction("draw_undo"),
  guess: roomHandlers.gameAction("guess"),
  typing: roomHandlers.gameAction("typing"),
  submit_suggestion: roomHandlers.gameAction("submit_suggestion"),
  vote_suggestion: roomHandlers.gameAction("vote_suggestion"),
  confirm_words_ready: roomHandlers.gameAction("confirm_words_ready"),
  ask_question: roomHandlers.gameAction("ask_question"),
  answer_question: roomHandlers.gameAction("answer_question"),
  concede: roomHandlers.gameAction("concede"),
  fire: roomHandlers.gameAction("fire"),
  use_item: roomHandlers.gameAction("use_item"),
  ready_for_duel: roomHandlers.gameAction("ready_for_duel"),
  back_to_lobby: roomHandlers.backToLobby,
  leave_room: roomHandlers.leaveRoom,
  kick_player: roomHandlers.kickPlayer,
  kick_member: groupHandlers.kickMember,
  // validateMessage (see server.ts) already narrowed `msg` to this exact
  // shape by the time a handler runs — the cast just tells TS what the
  // dispatch table itself can't express per-key.
  transfer_host: (ws, msg, info) => transferHost(ws, msg as Extract<ClientMessage, { type: "transfer_host" }>, info),
  ping: (ws: WS) => ping(ws),
};

module.exports = { HANDLERS, handleDisconnect };
