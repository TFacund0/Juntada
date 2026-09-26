// ─── WS Transport ────────────────────────────────────────────────────────────
// Wires the raw ws connection lifecycle to the message handlers. No game
// rules or state shape knowledge lives here.

import type { IncomingMessage } from "http";
import type { Server } from "http";
import { logger } from "../logger";
import { env } from "../env";

const { WebSocketServer } = require("ws");
const { clients } = require("../state/roomStore");
const { HANDLERS, handleDisconnect } = require("./handlers");
const { validateMessage } = require("./validation");
const { sendError } = require("./messaging");
const { isAllowed } = require("./rateLimiter");
const { captureException } = require("../sentry");
const { verifyAccessToken } = require("../auth/service/tokenService") as {
  verifyAccessToken: (token: string) => { sub: string };
};

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

// Cheap-to-abuse message types get a per-IP rate limit: creating rooms/groups
// exhausts server memory, and hammering join_room/join_group is a room/group
// code brute force.
// Several friends on the same wifi/NAT share one public IP, and each of them
// reconnecting a few times (flaky wifi, backgrounding a phone, a cold-started
// server timing out a first attempt) burns through this budget fast — these
// were tight enough to plausibly lock out a whole group trying to join or
// get back into the same room, not just an actual brute-force attempt.
const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  create_room: { limit: 10, windowMs: 60_000 },
  join_room: { limit: 60, windowMs: 60_000 },
  check_room_code: { limit: 60, windowMs: 60_000 },
  create_group: { limit: 10, windowMs: 60_000 },
  join_group: { limit: 60, windowMs: 60_000 },
  // Rayado Libre's canvas stream: the frontend batches pointer movement into
  // one message per short animation-frame window, which still easily clears
  // the blanket per-connection budget below over a 99s drawing turn — these
  // get their own generous, dedicated budget instead (see the `limit` lookup
  // in the message handler, which skips the global check once a per-type
  // limit like this one applies).
  draw_stroke: { limit: 400, windowMs: 10_000 },
  draw_fill: { limit: 50, windowMs: 10_000 },
  draw_clear: { limit: 10, windowMs: 10_000 },
  draw_undo: { limit: 20, windowMs: 10_000 },
  // Rayado Libre's "escribiendo…" ping: one player sends at most one every
  // 2s (TYPING_SEND_INTERVAL_MS), i.e. 5 per window — but the key is per IP,
  // and a whole group on the same wifi shares it, so this leaves room for
  // ~6 players typing at once without eating into GLOBAL_MESSAGE_LIMIT.
  typing: { limit: 30, windowMs: 10_000 },
  // A config range input (e.g. Tutifrutti's category-count slider) fires one
  // update_config per pixel while being dragged, easily clearing the blanket
  // GLOBAL_MESSAGE_LIMIT below in well under a second of normal use — same
  // reasoning as draw_stroke above, just for config screens instead of a
  // drawing canvas.
  update_config: { limit: 200, windowMs: 10_000 },
  // Chat is typed by hand, so real usage never comes close to this — just
  // enough headroom over the blanket GLOBAL_MESSAGE_LIMIT below (which every
  // other action in a round also shares) that a burst of messages doesn't
  // eat into a player's budget for actual game actions.
  send_room_chat: { limit: 20, windowMs: 10_000 },
  send_group_chat: { limit: 20, windowMs: 10_000 },
};

// Blanket per-connection limit covering every message type with no dedicated
// entry above (in-round actions like vote/submit_clue included), so a single
// client can't hammer the game loop with rapid-fire messages.
const GLOBAL_MESSAGE_LIMIT = { limit: 30, windowMs: 10_000 };

// Origin isn't sent by non-browser clients (native apps, test scripts), so
// only enforce it when present. Browsers always send it on WS handshakes,
// which is what we actually care about blocking here — some other site's
// page opening a socket to this backend on a visitor's behalf.
function isAllowedOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (env.CORS_ORIGIN) return origin === env.CORS_ORIGIN;
  // No CORS_ORIGIN configured means frontend and backend share an origin
  // (see env.ts/app.ts) — so the Origin header's host must match the Host
  // header the socket was actually opened against.
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

// The access JWT travels as the WS subprotocol value `jwt.<token>` (see
// design.md "Token transport") — a browser can't set custom headers on the
// WS handshake, and a `?token=` query param would land in Render/proxy
// access logs. `Sec-WebSocket-Protocol` is a comma-separated list (ws
// clients can offer several); only the `jwt.` prefixed entry matters here.
const JWT_PROTOCOL_PREFIX = "jwt.";

function extractAccessToken(req: IncomingMessage): string | null {
  const header = req.headers["sec-websocket-protocol"];
  if (!header) return null;
  const offered = String(header)
    .split(",")
    .map(p => p.trim());
  const jwtEntry = offered.find(p => p.startsWith(JWT_PROTOCOL_PREFIX));
  if (!jwtEntry) return null;
  const token = jwtEntry.slice(JWT_PROTOCOL_PREFIX.length);
  return token || null;
}

// Verifies the JWT and returns the authenticated accountId, or null if the
// token is missing/expired/tampered. Never throws — verifyAccessToken's own
// jwt.verify rejection is exactly the "invalid" case this WS handshake needs
// to reject as cleanly as a missing token.
function authenticateHandshake(req: IncomingMessage): string | null {
  const token = extractAccessToken(req);
  if (!token) return null;
  try {
    return verifyAccessToken(token).sub;
  } catch {
    return null;
  }
}

// Caps concurrent open sockets per IP so one client can't cheaply exhaust
// server memory/file descriptors by opening connections without ever
// sending create_room (which is what the per-message rate limits above
// guard against instead). Raised from 20: a household/group of friends
// sharing one public IP, each with a few tabs/devices and the odd stray
// reconnect (a not-yet-terminated stale socket lingers up to
// HEARTBEAT_INTERVAL_MS after going quiet), adds up fast against a cap this
// tight — this is meant to catch genuine abuse, not a normal group game night.
const MAX_CONNECTIONS_PER_IP = 60;
const connectionsPerIp = new Map<string, number>();

// A closed TCP connection fires "close" and lets handleDisconnect run, but a
// phone that dies or drops off wifi without a clean shutdown never sends
// that — the socket looks "open" forever and its room never gets cleaned up.
// Standard `ws` fix: ping everyone on an interval, and terminate() anyone
// who didn't pong since the last check. terminate() forces a "close" event,
// so it flows through the exact same handleDisconnect/cleanup path.
const HEARTBEAT_INTERVAL_MS = 30_000;

function attachWebSocketServer(httpServer: Server) {
  // ws defaults to no payload limit — every legitimate client message is a
  // small JSON blob (the largest config strings are capped at 2000 chars,
  // see shared-types), so this is generous headroom, not a tight budget.
  const wss = new WebSocketServer({ server: httpServer, maxPayload: 64 * 1024 });

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
  // Doesn't keep the process (or, in tests, the test runner) alive on its
  // own — the server closing is what should end the process, not a
  // still-ticking background interval with nothing left to ping.
  heartbeat.unref();
  wss.on("close", () => clearInterval(heartbeat));

  wss.on("connection", (ws: HeartbeatSocket, req: IncomingMessage) => {
    if (!isAllowedOrigin(req)) {
      ws.close(1008, "Origin not allowed");
      return;
    }

    // The JWT is verified before anything else about this connection is
    // trusted — an invalid/missing token closes the socket immediately,
    // before it's ever added to `clients` or counted against the per-IP
    // connection cap, and before a single message is ever read from it.
    const accountId = authenticateHandshake(req);
    if (!accountId) {
      ws.close(4000, "unauthorized");
      return;
    }

    const ip = clientIp(req);
    const openFromIp = (connectionsPerIp.get(ip) ?? 0) + 1;
    if (openFromIp > MAX_CONNECTIONS_PER_IP) {
      ws.close(1008, "Too many connections");
      return;
    }
    connectionsPerIp.set(ip, openFromIp);

    clients.set(ws, { groupCode: null, roomCode: null, playerId: null, accountId });
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Without a listener here, an "error" event (e.g. the maxPayload limit
    // above being exceeded) is unhandled and crashes the whole process —
    // Node's default EventEmitter behavior for "error" with no listener.
    // Just drop this one connection instead.
    ws.on("error", (err: Error) => {
      logger.warn({ err }, "websocket connection error");
      ws.terminate();
    });

    ws.on("message", (raw: Buffer) => {
      let msg: unknown;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      const { ok, data, error } = validateMessage(msg);
      if (!ok) {
        // Charged against the same blanket budget as any other untyped
        // message below — without this, a message with an unknown type or a
        // known type but corrupt payload always failed validateMessage
        // before ever reaching a rate-limit check, so it could be sent as
        // fast as the client liked (still cheap per-message — JSON.parse +
        // a schema safeParse — but with nothing capping the rate) while a
        // well-formed message of the same type gets throttled.
        if (!isAllowed(`${ip}:global`, GLOBAL_MESSAGE_LIMIT.limit, GLOBAL_MESSAGE_LIMIT.windowMs)) {
          sendError(ws, "RATE_LIMITED", "Estás yendo muy rápido, esperá un momento");
          return;
        }
        sendError(ws, "VALIDATION_ERROR", error);
        return;
      }

      const limit = RATE_LIMITS[data.type];
      if (limit) {
        if (!isAllowed(`${ip}:${data.type}`, limit.limit, limit.windowMs)) {
          sendError(ws, "RATE_LIMITED", "Estás yendo muy rápido, esperá un momento");
          return;
        }
      } else if (!isAllowed(`${ip}:global`, GLOBAL_MESSAGE_LIMIT.limit, GLOBAL_MESSAGE_LIMIT.windowMs)) {
        sendError(ws, "RATE_LIMITED", "Estás yendo muy rápido, esperá un momento");
        return;
      }

      const handler = HANDLERS[data.type];
      const info = clients.get(ws);
      // A handful of handlers (create_room/join_room/create_group/
      // join_group) are async — they resolve the account's current
      // username via authService.getSelf before mutating any state.
      // Promise.resolve(...) lets every handler, sync or async, funnel
      // through the exact same error handling below.
      Promise.resolve()
        .then(() => handler(ws, data, info))
        .catch((err: unknown) => {
          logger.error({ err, messageType: data.type }, "handler threw");
          captureException(err, { messageType: data.type });
          sendError(ws, "INTERNAL_ERROR", "Ocurrió un error inesperado");
        });
    });

    ws.on("close", () => {
      const remaining = (connectionsPerIp.get(ip) ?? 1) - 1;
      if (remaining <= 0) connectionsPerIp.delete(ip);
      else connectionsPerIp.set(ip, remaining);
      handleDisconnect(ws);
    });
  });

  return wss;
}

module.exports = { attachWebSocketServer };
