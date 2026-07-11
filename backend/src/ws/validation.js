// ─── WS Message Validation ───────────────────────────────────────────────────
// A raw ws message is untrusted input: it can come from anything speaking the
// wire protocol, not just this project's frontend. Every message type gets a
// schema here so a malformed/oversized/wrong-typed payload is rejected before
// it ever reaches a handler.

const { z } = require("zod");

const name = z.string().trim().min(1).max(40).optional();
const roomCode = z.string().trim().min(1).max(8);
const uuid = z.string().uuid();

// update_config is generic across every game (see games/registry.js), so its
// shape can't be pinned to one game's fields — but it must still reject
// anything that isn't plain, boundable data. Without this, a value like an
// object or a function would sail through as "valid config", get broadcast
// to every player in the room, and crash whichever UI tries to render it
// directly (e.g. a game rendering a config string straight into JSX).
const configPrimitive = z.union([z.string().max(2000), z.number(), z.boolean()]);
const configRecord = z.record(z.string(), configPrimitive);
const configValue = z.union([
  configPrimitive,
  z.array(configPrimitive).max(50),
  configRecord,
  z.array(configRecord).max(50),
]);

const SCHEMAS = {
  create_room: z.object({
    type: z.literal("create_room"),
    playerName: name,
    roomName: z.string().trim().max(60).optional(),
    gameType: z.string().max(30).optional(),
  }),
  join_room: z.object({
    type: z.literal("join_room"),
    code: roomCode,
    playerName: name,
  }),
  rejoin: z.object({
    type: z.literal("rejoin"),
    roomCode,
    playerId: uuid,
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
  submit_guess: z.object({
    type: z.literal("submit_guess"),
    value: z.number().int().min(0).max(100),
  }),
  confirm_round_setup: z.object({
    type: z.literal("confirm_round_setup"),
    psychicId: z.union([uuid, z.literal("random")]).optional(),
    spectrumMode: z.enum(["random", "same", "manual"]).optional(),
    left: z.string().trim().max(60).optional(),
    right: z.string().trim().max(60).optional(),
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
};

function validateMessage(msg) {
  const schema = SCHEMAS[msg?.type];
  if (!schema) return { ok: false, error: "Tipo de mensaje desconocido" };
  const result = schema.safeParse(msg);
  if (!result.success) return { ok: false, error: "Mensaje inválido" };
  return { ok: true, data: result.data };
}

module.exports = { validateMessage };
