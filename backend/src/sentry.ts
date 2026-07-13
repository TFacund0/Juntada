// ─── Error Tracking ──────────────────────────────────────────────────────────
// Thin wrapper around @sentry/node so the rest of the codebase never checks
// "is Sentry configured" itself — captureException/captureMessage are always
// safe to call and just no-op until SENTRY_DSN is set (see env.ts). Must be
// imported before anything else in server.ts so Sentry's instrumentation can
// hook in before other modules load.

import { env } from "./env";

const Sentry = require("@sentry/node");

let enabled = false;

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Game state changes constantly and none of it is sensitive (no
    // PII beyond a player-chosen display name), so tracing every request
    // isn't worth the overhead — this is purely for catching exceptions.
    tracesSampleRate: 0,
  });
  enabled = true;
}

function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

module.exports = { Sentry, captureException, enabled };
