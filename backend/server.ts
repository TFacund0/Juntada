import { env } from "./src/env";
import { logger } from "./src/logger";

// Imported before anything else so its instrumentation is in place before
// any other module (and the errors they might throw at require-time) loads.
const { captureException } = require("./src/sentry");

const { createApp } = require("./src/app");
const { loadSnapshot, startSnapshotLoop, saveSnapshot } = require("./src/state/persistence");

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

// Saves one last snapshot right at shutdown — covers the most common
// restart cause (a deploy) with fresh data instead of relying solely on
// persistence.ts's periodic interval. SIGTERM is what Render sends before
// killing the container; SIGINT is Ctrl+C for local dev. A no-op if
// REDIS_URL isn't set (see persistence.ts).
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down, saving final snapshot");
  await saveSnapshot();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

(async () => {
  // Restored before the server starts accepting connections, so there's no
  // window where a freshly created room could collide with one that's
  // about to be restored from the snapshot.
  await loadSnapshot();

  const server = createApp();
  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");
    startSnapshotLoop();
  });
})();
