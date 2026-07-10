// ─── WS Transport ────────────────────────────────────────────────────────────
// Wires the raw ws connection lifecycle to the message handlers. No game
// rules or state shape knowledge lives here.

const { WebSocketServer } = require("ws");
const { clients } = require("../state/roomStore");
const { HANDLERS, handleDisconnect } = require("./handlers");
const { validateMessage } = require("./validation");
const { sendTo } = require("./messaging");

function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws) => {
    clients.set(ws, { roomCode: null, playerId: null });

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      const { ok, data, error } = validateMessage(msg);
      if (!ok) { sendTo(ws, { type: "error", message: error }); return; }

      const handler = HANDLERS[data.type];
      const info = clients.get(ws);
      try {
        handler(ws, data, info);
      } catch (err) {
        console.error(`Error handling "${data.type}":`, err);
        sendTo(ws, { type: "error", message: "Ocurrió un error inesperado" });
      }
    });

    ws.on("close", () => handleDisconnect(ws));
  });

  return wss;
}

module.exports = { attachWebSocketServer };
