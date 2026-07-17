// ─── WS Message Handlers ────────────────────────────────────────────────────
// Aggregates every message type into one dispatch table, plus the handlers
// that are genuinely cross-cutting between a room and its group (transferHost,
// handleDisconnect — both need to touch whichever of the two the sender is
// currently in). Standalone-room handlers live in roomHandlers.ts,
// group/instance handlers in groupHandlers.ts, and helpers both share in
// shared.ts. No game rules live in any of these — those go through the
// engine registered for the room's gameType.

import type { Room, Group, ClientMessage } from "@juntada/shared-types";
import type { ClientInfo } from "../state/roomStore";
import { logger } from "../logger";

type WS = import("ws").WebSocket;

const { rooms, groups, clients } = require("../state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
  clients: Map<WS, ClientInfo>;
};
const roomService = require("../rooms/roomService");
const groupService = require("../rooms/groupService");
const { sendTo, broadcastState, broadcastGroupState, getRoomPublicState, broadcastRoundReveal } = require("./messaging");
const { syncPhaseTimer } = require("./shared");
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
  if (info?.roomCode && info.playerId) {
    const room = rooms.get(info.roomCode);
    if (room) {
      logger.debug({ roomCode: room.code, playerId: info.playerId }, "player disconnected");
      roomService.markOffline(room, info.playerId);
      broadcastState(room);
      if (room.phase === "result") broadcastRoundReveal(room);
      if (room.round) syncPhaseTimer(room);
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

type Handler = (ws: WS, msg: any, info: ClientInfo) => void;

// Message type -> handler(ws, msg, info)
const HANDLERS: Record<string, Handler> = {
  create_room: (ws, msg) => roomHandlers.createRoom(ws, msg),
  join_room: (ws, msg) => roomHandlers.joinRoom(ws, msg),
  check_room_code: (ws, msg) => roomHandlers.checkRoomCode(ws, msg),
  rejoin: (ws, msg) => roomHandlers.rejoin(ws, msg),
  create_group: (ws, msg) => groupHandlers.createGroup(ws, msg),
  join_group: (ws, msg) => groupHandlers.joinGroup(ws, msg),
  rejoin_group: (ws, msg) => groupHandlers.rejoinGroup(ws, msg),
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
  continue_round: roomHandlers.gameAction("continue_round"),
  submit_guess: roomHandlers.gameAction("submit_guess"),
  confirm_round_setup: roomHandlers.gameAction("confirm_round_setup"),
  submit_spectrum: roomHandlers.gameAction("submit_spectrum"),
  new_game: roomHandlers.gameAction("new_game"),
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
  back_to_lobby: roomHandlers.backToLobby,
  kick_player: roomHandlers.kickPlayer,
  transfer_host: transferHost,
  ping: (ws: WS) => ping(ws),
};

module.exports = { HANDLERS, handleDisconnect };
