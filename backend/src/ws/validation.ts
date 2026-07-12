// ─── WS Message Validation ───────────────────────────────────────────────────
// A raw ws message is untrusted input: it can come from anything speaking the
// wire protocol, not just this project's frontend. SCHEMAS (the canonical
// contract, one zod schema per message type) lives in @juntada/shared-types so
// both this validator and the ClientMessage type it produces are derived from
// the exact same definition — nothing here can drift from what's exported.

import { SCHEMAS, type ClientMessage, type ClientMessageType } from "@juntada/shared-types";

type ValidateResult = { ok: true; data: ClientMessage } | { ok: false; error: string };

function validateMessage(msg: unknown): ValidateResult {
  const type = (msg as { type?: unknown })?.type;
  const schema = SCHEMAS[type as ClientMessageType];
  if (!schema) return { ok: false, error: "Tipo de mensaje desconocido" };
  const result = schema.safeParse(msg);
  if (!result.success) return { ok: false, error: "Mensaje inválido" };
  return { ok: true, data: result.data as ClientMessage };
}

module.exports = { validateMessage };
