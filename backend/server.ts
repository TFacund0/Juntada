import { env } from "./src/env";
import { logger } from "./src/logger";

// Imported before anything else so its instrumentation is in place before
// any other module (and the errors they might throw at require-time) loads.
const { captureException } = require("./src/sentry");

const { createApp } = require("./src/app");

// Node exits (or gets left in a broken state) either way, but this ensures
// the crash actually reaches Sentry before the process goes down instead of
// only ending up in a log line nobody's watching.
process.on("uncaughtException", (err: unknown) => {
  captureException(err);
  logger.error({ err }, "uncaught exception");
});
process.on("unhandledRejection", (reason: unknown) => {
  captureException(reason);
  logger.error({ err: reason }, "unhandled rejection");
});

const server = createApp();
server.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening"));
