// ─── Shared Types ────────────────────────────────────────────────────────────
// Single source of truth for the shapes that cross the client/server boundary.
// SCHEMAS is the canonical wire contract for client→server messages: the
// backend imports it at runtime to validate every inbound message
// (backend/src/ws/validation.ts), and ClientMessage below is derived straight
// from it via z.infer so the type can never drift from what's actually
// enforced. Everything else here (Room/Player/ServerMessage) is currently
// hand-written to match backend/src/ws/messaging.js — as that file migrates
// to TS it should import these instead of re-declaring the shapes.

import { z } from "zod";

const name = z.string().trim().min(1).max(40).optional();
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
    playerName: name,
    roomName: z.string().trim().max(60).optional(),
    gameType: z.string().max(30),
  }),
  join_room: z.object({
    type: z.literal("join_room"),
    code: roomCode,
    playerName: name,
  }),
  // Read-only lookup so the join form can preview which room a code points
  // to (name + game) before the player commits to joining it — no side
  // effects, doesn't register a client/player.
  check_room_code: z.object({
    type: z.literal("check_room_code"),
    code: roomCode,
  }),
  rejoin: z.object({
    type: z.literal("rejoin"),
    roomCode,
    playerId: uuid,
  }),
  create_group: z.object({
    type: z.literal("create_group"),
    playerName: name,
    groupName: z.string().trim().max(60).optional(),
  }),
  join_group: z.object({
    type: z.literal("join_group"),
    code: roomCode,
    playerName: name,
    groupName: z.string().trim().max(60).optional(),
  }),
  rejoin_group: z.object({
    type: z.literal("rejoin_group"),
    groupCode: roomCode,
    playerId: uuid,
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
    answer: z.enum(["si", "no"]),
    comment: z.string().trim().max(200).optional(),
  }),
  concede: z.object({
    type: z.literal("concede"),
  }),
} as const;

export type ClientMessageType = keyof typeof SCHEMAS;
export type ClientMessage = z.infer<(typeof SCHEMAS)[ClientMessageType]>;

// ─── Room / Player ───────────────────────────────────────────────────────────
// `config` and `round` stay loosely typed here — each game engine defines its
// own shape for them, which isn't tied down yet (planned for a later phase,
// once the engines themselves migrate to TS one at a time).

export interface Player {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
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
  config: Record<string, unknown>;
  round: unknown;
  usedWords: Record<string, unknown>;
  roundHistory: unknown[];
}

export interface RoomPublicState {
  code: string;
  name: string;
  hostId: string;
  gameType: string;
  groupCode: string | null;
  phase: string;
  players: PublicPlayer[];
  maxPlayers: number;
  config: Record<string, unknown>;
  round: unknown;
  usedWords: Record<string, unknown>;
  roundHistory: unknown[];
}

// ─── Group ───────────────────────────────────────────────────────────────────
// A group is a persistent lobby of people (its own code, its own member
// list) that can have several game instances (Room above) open under it at
// once — anyone in the group can start one, and each member decides on
// their own whether to join it, independent of what anyone else is doing.
export interface GroupMember {
  id: string;
  name: string;
  online: boolean;
}

export interface Group {
  code: string;
  name: string;
  hostId: string; // the group's creator — mostly informational, doesn't gate instance actions
  members: GroupMember[];
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
  | { type: "left_group" }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "kicked" }
  | { type: "kicked_from_group" }
  | { type: "pong" }
  | { type: "room_preview"; code: string; found: boolean; name?: string; gameType?: string; isGroupCode?: boolean }
  | ({ type: string } & Record<string, unknown>);
