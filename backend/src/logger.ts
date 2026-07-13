// ─── Logger ──────────────────────────────────────────────────────────────────
// Structured logging (Pino) so a production incident can be reconstructed
// from logs instead of needing to reproduce it by hand. Pretty-printed in
// dev for readability; plain JSON in production (Render and most log
// collectors expect/parse JSON lines, and pino-pretty is dev-only tooling —
// see its own docs against using it in prod).
//
// Keep log payloads to identifiers (roomCode, playerId, gameType) and short
// messages — never full room state or message payloads, which can carry
// player-entered text.

import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
});
