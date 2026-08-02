// ─── App Bootstrap ───────────────────────────────────────────────────────────
// Composes the express app, http server and websocket server. Kept separate
// from server.js so it can be imported by tests without binding a port.

import type { Server } from "http";
import { env } from "./env";

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");
const { registerRoutes } = require("./http/routes");
const { attachWebSocketServer } = require("./ws/server");
const { Sentry, enabled: sentryEnabled } = require("./sentry");

// Every route here is either /health or serving the built frontend (see
// http/routes.ts) — there's no state-changing HTTP endpoint to protect
// individually the way ws/server.ts's RATE_LIMITS does per message type.
// This is just a blanket floor against a basic flood (a script hammering
// /health, or scraping every static asset in a loop): generous enough that
// a real page load — index.html plus its JS/CSS bundles — never comes close,
// since those are also cached aggressively by the browser after the first
// hit (see routes.ts's Cache-Control headers).
const httpRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

function createApp(): Server {
  const app = express();
  // Frontend and backend are served from the same origin in production (see
  // render.yaml), so this mostly guards against other sites hitting /health
  // directly. Left permissive unless CORS_ORIGIN is set, since local dev runs
  // the Vite frontend on a different port than the backend.
  app.use(cors(env.CORS_ORIGIN ? { origin: env.CORS_ORIGIN } : undefined));
  // The built frontend (JS/CSS/HTML) is served straight from this Express
  // app with no CDN in front of it (see render.yaml) — without this, none
  // of it is compressed in transit, which matters most on the slow
  // connections this app is meant to be resilient to.
  app.use(compression());
  app.use(httpRateLimiter);
  app.use(express.json());
  registerRoutes(app);
  // Must be wired after every route so it only catches what the routes
  // themselves didn't handle — a no-op if SENTRY_DSN isn't set (see sentry.ts).
  if (sentryEnabled) Sentry.setupExpressErrorHandler(app);

  const server = createServer(app);
  attachWebSocketServer(server);

  return server;
}

module.exports = { createApp };
