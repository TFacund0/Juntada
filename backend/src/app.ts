// ─── App Bootstrap ───────────────────────────────────────────────────────────
// Composes the express app, http server and websocket server. Kept separate
// from server.js so it can be imported by tests without binding a port.

import type { Server } from "http";
import { env } from "./env";

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const { createServer } = require("http");
const { registerRoutes } = require("./http/routes");
const { attachWebSocketServer } = require("./ws/server");

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
  app.use(express.json());
  registerRoutes(app);

  const server = createServer(app);
  attachWebSocketServer(server);

  return server;
}

module.exports = { createApp };
