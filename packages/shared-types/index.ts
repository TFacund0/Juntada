// ─── Shared Types ────────────────────────────────────────────────────────────
// Single source of truth for the shapes that cross the client/server boundary.
// SCHEMAS is the canonical wire contract for client→server messages: the
// backend imports it at runtime to validate every inbound message
// (backend/src/ws/validation.ts), and ClientMessage below is derived straight
// from it via z.infer so the type can never drift from what's actually
// enforced. Everything else here (Room/Player/ServerMessage) is hand-written
// to match backend/src/ws/messaging.ts, which imports these directly.

import { z } from "zod";

const roomCode = z.string().trim().min(1).max(8);
const uuid = z.string().uuid();

// update_config is generic across every game (see games/registry.js), so its
// shape can't be pinned to one game's fields — but it must still reject
// anything that isn't plain, boundable data. 300 matches the longest
// legitimate free-text config field already in use (limon-limon's card
// descriptions, capped client-side at the same length — see
// DescriptionsEditor.tsx's MAX_LENGTH); a team name or ruleta entry needs
// far less. Comfortably more than any real value, nowhere near enough to
// let a pasted wall of text broadcast to (and desync the layout of) the
// whole room.
const configPrimitive = z.union([z.string().max(300), z.number(), z.boolean()]);
const configRecord = z.record(z.string(), configPrimitive);
const configValue = z.union([configPrimitive, z.array(configPrimitive).max(50), configRecord, z.array(configRecord).max(50)]);

// Rayado Libre's board is a fixed 800x600 (see Canvas.tsx's CANVAS_WIDTH/
// CANVAS_HEIGHT) — coupled to that constant on purpose, not imported from
// it, since this schema has to stay a plain data description. The margin
// beyond the edges tolerates a pointer briefly overshooting the canvas
// element while still rejecting a modified client sending wildly out-of-
// bounds coordinates that would otherwise sit in room.round.strokes and get
// re-broadcast on every subsequent draw action.
const drawCoord = z.number().min(-200).max(1000);

export const SCHEMAS = {
  create_room: z.object({
    type: z.literal("create_room"),
    roomName: z.string().trim().max(60).optional(),
    gameType: z.string().max(30),
  }),
  join_room: z.object({
    type: z.literal("join_room"),
    code: roomCode,
  }),
  // Read-only lookup so the join form can preview which room a code points
  // to (name + game) before the player commits to joining it — no side
  // effects, doesn't register a client/player.
  check_room_code: z.object({
    type: z.literal("check_room_code"),
    code: roomCode,
  }),
  // Identity is resolved entirely from the authenticated WS handshake (the
  // JWT's accountId) — no client-supplied playerId anymore (see
  // design.md's account-reconnection delta).
  rejoin: z.object({
    type: z.literal("rejoin"),
    roomCode,
  }),
  create_group: z.object({
    type: z.literal("create_group"),
    groupName: z.string().trim().max(60).optional(),
  }),
  join_group: z.object({
    type: z.literal("join_group"),
    code: roomCode,
    groupName: z.string().trim().max(60).optional(),
  }),
  rejoin_group: z.object({
    type: z.literal("rejoin_group"),
    groupCode: roomCode,
  }),
  create_instance: z.object({
    type: z.literal("create_instance"),
    gameType: z.string().max(30),
  }),
  join_instance: z.object({
    type: z.literal("join_instance"),
    roomCode,
  }),
  leave_instance: z.object({
    type: z.literal("leave_instance"),
  }),
  leave_group: z.object({
    type: z.literal("leave_group"),
  }),
  update_config: z.object({
    type: z.literal("update_config"),
    config: z.record(z.string(), configValue).refine(cfg => Object.keys(cfg).length <= 50, "Config con demasiadas claves"),
  }),
  start_round: z.object({
    type: z.literal("start_round"),
  }),
  submit_clue: z.object({
    type: z.literal("submit_clue"),
    clue: z.string().max(200).optional(),
  }),
  player_ready: z.object({
    type: z.literal("player_ready"),
  }),
  vote: z.object({
    type: z.literal("vote"),
    suspectId: uuid,
  }),
  skip_word: z.object({
    type: z.literal("skip_word"),
  }),
  cancel_skip_word: z.object({
    type: z.literal("cancel_skip_word"),
  }),
  continue_round: z.object({
    type: z.literal("continue_round"),
  }),
  // Impostor's discussion-phase chat — only accepted by the engine when
  // discussionMode is "chat" and room.phase is "discussion" (see engine.ts),
  // but validated at the wire level regardless so a malformed/oversized
  // message never even reaches game logic.
  send_chat_message: z.object({
    type: z.literal("send_chat_message"),
    text: z.string().trim().min(1).max(300),
  }),
  // Free-text side-channel chat — independent of any game mechanic (unlike
  // send_chat_message above, which only some engines accept mid-round). One
  // for whichever game instance the sender is currently attached to, one for
  // the group screen itself; see the floating chat bubble in
  // features/multiplayer.
  send_room_chat: z.object({
    type: z.literal("send_room_chat"),
    text: z.string().trim().min(1).max(300),
  }),
  send_group_chat: z.object({
    type: z.literal("send_group_chat"),
    text: z.string().trim().min(1).max(300),
  }),
  // Shared by Sintonía (a 0-100 dial value) and Encuentra el Color Correcto
  // (a "#rrggbb" hex string) — each engine's own handleAction re-validates
  // the shape it actually expects and rejects the other's, so a permissive
  // union here just keeps both games off the same wire-level schema instead
  // of needing two differently-named actions for what's conceptually the
  // same "submit my answer for this round" message.
  submit_guess: z.object({
    type: z.literal("submit_guess"),
    value: z.union([z.number().int().min(0).max(100), z.string().max(20)]),
  }),
  confirm_round_setup: z.object({
    type: z.literal("confirm_round_setup"),
    psychicId: z.union([uuid, z.literal("random")]).optional(),
    spectrumMode: z.enum(["random", "same", "manual"]).optional(),
    left: z.string().trim().max(60).optional(),
    right: z.string().trim().max(60).optional(),
  }),
  submit_spectrum: z.object({
    type: z.literal("submit_spectrum"),
    mode: z.enum(["random", "same", "manual"]),
    left: z.string().trim().max(60).optional(),
    right: z.string().trim().max(60).optional(),
  }),
  new_game: z.object({
    type: z.literal("new_game"),
  }),
  force_finish_round: z.object({
    type: z.literal("force_finish_round"),
  }),
  report_result: z.object({
    type: z.literal("report_result"),
    roundIdx: z.number().int().min(0),
    matchIdx: z.number().int().min(0),
    goalsA: z.union([z.number(), z.string()]).optional(),
    goalsB: z.union([z.number(), z.string()]).optional(),
    winnerSide: z.enum(["a", "b"]).optional(),
  }),
  mark: z.object({
    type: z.literal("mark"),
    index: z.number().int().min(0).max(8),
  }),
  reset_score_vote: z.object({
    type: z.literal("reset_score_vote"),
  }),
  cancel_score_reset: z.object({
    type: z.literal("cancel_score_reset"),
  }),
  back_to_lobby: z.object({
    type: z.literal("back_to_lobby"),
  }),
  // A player choosing to leave a standalone (groupless) room mid-match on
  // their own — same idea as leave_instance for a group's instance, but with
  // no group to fall back to: removes them from the room right away instead
  // of waiting out the 1-minute offline-kick grace period, so the rest of
  // the room isn't stuck waiting on someone who already walked away.
  leave_room: z.object({
    type: z.literal("leave_room"),
  }),
  reveal: z.object({
    type: z.literal("reveal"),
  }),
  assign: z.object({
    type: z.literal("assign"),
    targetId: uuid,
  }),
  vote_end: z.object({
    type: z.literal("vote_end"),
  }),
  kick_player: z.object({
    type: z.literal("kick_player"),
    targetId: uuid,
  }),
  transfer_host: z.object({
    type: z.literal("transfer_host"),
    targetId: uuid,
  }),
  kick_member: z.object({
    type: z.literal("kick_member"),
    targetId: uuid,
  }),
  ping: z.object({
    type: z.literal("ping"),
  }),
  confirm_letter: z.object({
    type: z.literal("confirm_letter"),
    reroll: z.boolean().optional(),
  }),
  submit_answers: z.object({
    type: z.literal("submit_answers"),
    answers: z.record(z.string(), z.string().max(60)).refine(a => Object.keys(a).length <= 50, "Demasiadas categorías"),
  }),
  call_basta: z.object({
    type: z.literal("call_basta"),
  }),
  mark_word: z.object({
    type: z.literal("mark_word"),
    targetPlayerId: uuid,
    categoryId: z.string().max(60),
    valid: z.boolean(),
  }),
  confirm_review: z.object({
    type: z.literal("confirm_review"),
  }),
  spin: z.object({
    type: z.literal("spin"),
  }),
  confirm_eliminate: z.object({
    type: z.literal("confirm_eliminate"),
  }),
  spin_again: z.object({
    type: z.literal("spin_again"),
  }),
  choose_word: z.object({
    type: z.literal("choose_word"),
    word: z.string().trim().max(60),
  }),
  reroll_word: z.object({
    type: z.literal("reroll_word"),
  }),
  draw_stroke: z.object({
    type: z.literal("draw_stroke"),
    points: z
      .array(z.tuple([drawCoord, drawCoord]))
      .min(1)
      .max(300),
    color: z.string().max(20),
    size: z.number().min(1).max(60),
    // Groups the chunks one continuous pointer gesture gets split into, so
    // "undo" can drop a whole stroke at once instead of just its last chunk.
    strokeId: z.number().int().min(0),
  }),
  draw_fill: z.object({
    type: z.literal("draw_fill"),
    x: drawCoord,
    y: drawCoord,
    color: z.string().max(20),
  }),
  draw_clear: z.object({
    type: z.literal("draw_clear"),
  }),
  draw_undo: z.object({
    type: z.literal("draw_undo"),
  }),
  guess: z.object({
    type: z.literal("guess"),
    text: z.string().trim().min(1).max(60),
  }),
  // ¿Quién Soy? — see backend/src/games/quien-soy/engine.ts. One word per
  // other player in the room, keyed by their player id — submitted together
  // as a single batch rather than one at a time.
  submit_suggestion: z.object({
    type: z.literal("submit_suggestion"),
    suggestions: z.record(z.string(), z.string().trim().min(1).max(60)),
  }),
  vote_suggestion: z.object({
    type: z.literal("vote_suggestion"),
    suggestionIndex: z.number().int().min(0).max(50),
  }),
  // Host-only: moves on from the "assign" phase (words decided, briefly
  // shown) into "playing" once everyone's ready to start asking questions.
  confirm_words_ready: z.object({
    type: z.literal("confirm_words_ready"),
  }),
  ask_question: z.object({
    type: z.literal("ask_question"),
    text: z.string().trim().min(1).max(200),
  }),
  answer_question: z.object({
    type: z.literal("answer_question"),
    answer: z.enum(["si", "no", "skip"]),
    comment: z.string().trim().max(200).optional(),
  }),
  concede: z.object({
    type: z.literal("concede"),
  }),
  // Recámara — see backend/src/games/recamara/engine.ts. targetId/victim
  // ids are the room's own player ids (uuid), already translated from the
  // shared engine's small numeric ids by the time they cross the wire.
  fire: z.object({
    type: z.literal("fire"),
    targetId: uuid,
  }),
  use_item: z.object({
    type: z.literal("use_item"),
    item: z.enum(["🔍", "🚬", "🪚", "🔄", "🧤", "📞", "🔒"]),
    targetId: uuid.optional(),
    stolenItem: z.enum(["🔍", "🚬", "🪚", "🔄", "🧤", "📞", "🔒"]).optional(),
  }),
  ready_for_duel: z.object({
    type: z.literal("ready_for_duel"),
  }),
} as const;

export type ClientMessageType = keyof typeof SCHEMAS;
export type ClientMessage = z.infer<(typeof SCHEMAS)[ClientMessageType]>;

// ─── Room / Player ───────────────────────────────────────────────────────────
// `config` and `round` stay loosely typed here — each game engine defines its
// own shape for them, which isn't tied down yet (planned for a later phase,
// once the engines themselves migrate to TS one at a time).

// A free-text side-channel message — either room-scoped (in-game chat,
// cleared with the instance) or group-scoped (persists across whatever
// instance is open). See send_room_chat/send_group_chat above.
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  ts: number;
}

export interface Player {
  id: string;
  // The authenticated account this seat belongs to — resolved from the WS
  // handshake JWT, never client-supplied. `id` stays the per-room seat id
  // every game engine already keys on (see design.md "no engine changes
  // needed"); `accountId` is what account-reconnection (rejoin) resolves
  // the seat by instead.
  accountId: string;
  name: string;
  ready: boolean;
  online: boolean;
  // Timestamp (Date.now()) of when this player went offline — lets a game's
  // RoundView show a live "kicked in Xs" countdown alongside its own
  // per-game auto-kick timeout (see GameEngine.offlineKickTimeoutMs). Unset
  // while online.
  offlineSince?: number;
}

export interface PublicPlayer extends Player {
  hasVoted: boolean;
}

export interface Room {
  code: string;
  name: string;
  hostId: string;
  gameType: string;
  // Which group this instance belongs to, if any — null for a room created
  // directly for one game (the original, group-less flow). Set when the
  // instance was opened from inside a group (see create_instance).
  groupCode: string | null;
  phase: string;
  players: Player[];
  // Joined while a round was already in progress — held here (not in
  // `players`) so no game engine has to know they exist: engines only ever
  // read `players`, so a waiting joiner can't accidentally get a role, count
  // toward a "ready" gate, or take a turn. Moved into `players` automatically
  // once the room's phase returns to "lobby" (see ws/shared.ts's
  // flushWaitingPlayers). Still counts against maxPlayers while waiting.
  waitingPlayers: Player[];
  config: Record<string, unknown>;
  round: unknown;
  usedWords: Record<string, unknown>;
  roundHistory: unknown[];
  chat: ChatMessage[];
}

export interface RoomPublicState {
  code: string;
  name: string;
  hostId: string;
  gameType: string;
  groupCode: string | null;
  phase: string;
  players: PublicPlayer[];
  // Optional only so existing test fixtures built before this field existed
  // keep compiling — every real server response always sets it (see
  // ws/messaging.ts's getRoomPublicState). Treat a missing value as empty.
  waitingPlayers?: PublicPlayer[];
  maxPlayers: number;
  config: Record<string, unknown>;
  round: unknown;
  usedWords: Record<string, unknown>;
  roundHistory: unknown[];
  chat: ChatMessage[];
}

// ─── Group ───────────────────────────────────────────────────────────────────
// A group is a persistent lobby of people (its own code, its own member
// list) that can have several game instances (Room above) open under it at
// once — anyone in the group can start one, and each member decides on
// their own whether to join it, independent of what anyone else is doing.
export interface GroupMember {
  id: string;
  accountId: string;
  name: string;
  online: boolean;
}

export interface Group {
  code: string;
  name: string;
  hostId: string; // the group's creator — mostly informational, doesn't gate instance actions
  members: GroupMember[];
  chat: ChatMessage[];
}

// One open game instance, as seen from the group screen — enough to show a
// join button without pulling in that game's full round state.
export interface GroupInstanceSummary {
  roomCode: string;
  gameType: string;
  phase: string;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

export interface GroupPublicState {
  code: string;
  name: string;
  hostId: string;
  members: GroupMember[];
  maxMembers: number;
  instances: GroupInstanceSummary[];
  chat: ChatMessage[];
}

// ─── Server → Client ─────────────────────────────────────────────────────────
// Every error the server sends carries a stable machine-readable `code`
// alongside the human-readable `message` — the code is what a client should
// branch on (e.g. show a "reconnect" flow for RATE_LIMITED), the message is
// what gets shown to the player. See backend/src/ws/messaging.ts's
// `sendError`, the one place these get constructed.
export type ErrorCode =
  | "VALIDATION_ERROR" // inbound message failed its zod schema
  | "RATE_LIMITED"
  | "CREATE_ROOM_FAILED"
  | "JOIN_ROOM_FAILED"
  | "REJOIN_FAILED"
  | "CREATE_GROUP_FAILED"
  | "JOIN_GROUP_FAILED"
  | "REJOIN_GROUP_FAILED"
  | "CREATE_INSTANCE_FAILED"
  | "JOIN_INSTANCE_FAILED"
  | "LEAVE_GROUP_FAILED"
  | "NOT_ENOUGH_PLAYERS"
  | "START_ROUND_FAILED"
  | "INVALID_ACTION" // handleAction rejected it for the current phase/state
  | "INTERNAL_ERROR"; // engine/handler threw — see server logs for detail

// `private_role` and per-engine reveal messages (e.g. impostor's and
// sintonia's own "word_reveal", which share a `type` but not a payload
// shape) aren't a clean discriminated union yet without an extra
// discriminant — left as a catch-all until the engines migrate.
export type ServerMessage =
  | { type: "state"; room: RoomPublicState }
  | { type: "joined"; playerId: string; roomCode: string; room: RoomPublicState }
  | { type: "group_state"; group: GroupPublicState }
  | { type: "group_joined"; playerId: string; groupCode: string; group: GroupPublicState }
  | { type: "left_instance" }
  | { type: "left_room" }
  | { type: "left_group" }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "kicked" }
  | { type: "kicked_from_group" }
  | { type: "pong" }
  | { type: "room_preview"; code: string; found: boolean; name?: string; gameType?: string; isGroupCode?: boolean }
  | ({ type: string } & Record<string, unknown>);
