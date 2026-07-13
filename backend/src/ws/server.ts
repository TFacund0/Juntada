// ─── WS Transport ────────────────────────────────────────────────────────────
// Wires the raw ws connection lifecycle to the message handlers. No game
// rules or state shape knowledge lives here.

import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "../logger";

const { WebSocketServer } = require("ws");
const { clients } = require("../state/roomStore");
const { HANDLERS, handleDisconnect } = require("./handlers");
const { validateMessage } = require("./validation");
const { sendTo, sendError } = require("./messaging");
const { isAllowed } = require("./rateLimiter");

// ws doesn't type this — it's a property we stamp on each socket ourselves
// for the heartbeat below (see HEARTBEAT_INTERVAL_MS).
type HeartbeatSocket = import("ws").WebSocket & { isAlive?: boolean };

// Behind Render's proxy (and most PaaS), the real client IP is the first
// entry of x-forwarded-for; fall back to the socket address for local dev.
function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

// Cheap-to-abuse message types get a per-IP rate limit: creating rooms
// exhausts server memory, and hammering join_room is a room-code brute force.
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  create_room: { limit: 5, windowMs: 60_000 },
  join_room: { limit: 20, windowMs: 60_000 },
};

// A closed TCP connection fires "close" and lets handleDisconnect run, but a
// phone that dies or drops off wifi without a clean shutdown never sends
// that — the socket looks "open" forever and its room never gets cleaned up.
// Standard `ws` fix: ping everyone on an interval, and terminate() anyone
// who didn't pong since the last check. terminate() forces a "close" event,
// so it flows through the exact same handleDisconnect/cleanup path.
const HEARTBEAT_INTERVAL_MS = 30_000;

function attachWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients as Set<HeartbeatSocket>) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);
  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: HeartbeatSocket, req: IncomingMessage) => {
    clients.set(ws, { roomCode: null, playerId: null });
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });
    const ip = clientIp(req);

    ws.on("message", (raw: Buffer) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const { ok, data, error } = validateMessage(msg);
      if (!ok) {
        sendError(ws, "VALIDATION_ERROR", error);
        return;
      }

      const limit = RATE_LIMITS[data.type];
      if (limit && !isAllowed(`${ip}:${data.type}`, limit.limit, limit.windowMs)) {
        sendError(ws, "RATE_LIMITED", "Estás yendo muy rápido, esperá un momento");
        return;
      }

      const handler = HANDLERS[data.type];
      const info = clients.get(ws);
      try {
        handler(ws, data, info);
      } catch (err) {
        logger.error({ err, messageType: data.type }, "handler threw");
        sendError(ws, "INTERNAL_ERROR", "Ocurrió un error inesperado");
      }
    });

    ws.on("close", () => handleDisconnect(ws));
  });

  return wss;
}

module.exports = { attachWebSocketServer };
