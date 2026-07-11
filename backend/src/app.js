// ─── App Bootstrap ───────────────────────────────────────────────────────────
// Composes the express app, http server and websocket server. Kept separate
// from server.js so it can be imported by tests without binding a port.

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const { createServer } = require("http");
const { registerRoutes } = require("./http/routes");
const { attachWebSocketServer } = require("./ws/server");

function createApp() {
  const app = express();
  app.use(cors());
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
