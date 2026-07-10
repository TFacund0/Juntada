// ─── WS Message Validation ───────────────────────────────────────────────────
// A raw ws message is untrusted input: it can come from anything speaking the
// wire protocol, not just this project's frontend. Every message type gets a
// schema here so a malformed/oversized/wrong-typed payload is rejected before
// it ever reaches a handler.

const { z } = require("zod");

const name = z.string().trim().min(1).max(40).optional();
const roomCode = z.string().trim().min(1).max(8);
const uuid = z.string().uuid();

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
    config: z.record(z.string(), z.any()),
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
  kick_player: z.object({
    type: z.literal("kick_player"),
    targetId: uuid,
  }),
  ping: z.object({
    type: z.literal("ping"),
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
