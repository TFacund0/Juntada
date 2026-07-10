// ─── WS Transport ────────────────────────────────────────────────────────────
// Wires the raw ws connection lifecycle to the message handlers. No game
// rules or state shape knowledge lives here.

const { WebSocketServer } = require("ws");
const { clients } = require("../state/roomStore");
const { HANDLERS, handleDisconnect } = require("./handlers");
const { validateMessage } = require("./validation");
const { sendTo } = require("./messaging");
const { isAllowed } = require("./rateLimiter");

// Behind Render's proxy (and most PaaS), the real client IP is the first
// entry of x-forwarded-for; fall back to the socket address for local dev.
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

// Cheap-to-abuse message types get a per-IP rate limit: creating rooms
// exhausts server memory, and hammering join_room is a room-code brute force.
const RATE_LIMITS = {
  create_room: { limit: 5, windowMs: 60_000 },
  join_room: { limit: 20, windowMs: 60_000 },
};

function attachWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    clients.set(ws, { roomCode: null, playerId: null });
    const ip = clientIp(req);

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      const { ok, data, error } = validateMessage(msg);
      if (!ok) { sendTo(ws, { type: "error", message: error }); return; }

      const limit = RATE_LIMITS[data.type];
      if (limit && !isAllowed(`${ip}:${data.type}`, limit.limit, limit.windowMs)) {
        sendTo(ws, { type: "error", message: "Estás yendo muy rápido, esperá un momento" });
        return;
      }

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
