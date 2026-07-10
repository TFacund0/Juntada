// ─── App Bootstrap ───────────────────────────────────────────────────────────
// Composes the express app, http server and websocket server. Kept separate
// from server.js so it can be imported by tests without binding a port.

const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { registerRoutes } = require("./http/routes");
const { attachWebSocketServer } = require("./ws/server");

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  registerRoutes(app);

  const server = createServer(app);
  attachWebSocketServer(server);

  return server;
}

module.exports = { createApp };
