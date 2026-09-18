// ─── WS Server Integration Test ─────────────────────────────────────────────
// Unlike the other test/*.test.ts files, which call the room/group services
// directly with a fake socket, this one boots the real HTTP+WebSocket server
// (see src/app.ts, built specifically to be importable without binding a
// port) and drives it with a real `ws` client over an actual ephemeral port.
// It exists because a real bug (creating a standalone room without ever
// having created a group failed client-side) went unnoticed by the
// service-level tests, which never touch the actual WS wire protocol.
//
// Every socket here must authenticate at the handshake (see ws/server.ts) —
// the access JWT travels as the `jwt.<token>` WS subprotocol value. See
// wsAuthTestUtils.ts for how a token is minted without a live Postgres.

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { installFakeAuthService, registerTestAccount, jwtProtocol } = require("../wsAuthTestUtils");

installFakeAuthService();

const { createApp } = require("../../src/app");

type WSClient = import("ws").WebSocket;

let server: import("http").Server;
let wsUrl: string;

before(async () => {
  server = createApp();
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  wsUrl = `ws://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  const { rooms, groups, clients } = require("../../src/state/roomStore");
  rooms.clear();
  groups.clear();
  clients.clear();
});

function openSocket(protocols?: string[]): Promise<WSClient> {
  return new Promise((resolve, reject) => {
    const ws = protocols ? new WebSocket(wsUrl, protocols) : new WebSocket(wsUrl);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
}

// Opens a socket authenticated as a fresh test account, returning both the
// socket and the accountId it's bound to (for assertions/second-device tests).
async function openAuthenticatedSocket(username: string): Promise<{ ws: WSClient; accountId: string; token: string }> {
  const { accountId, token } = registerTestAccount(username);
  const ws = await openSocket(jwtProtocol(token));
  return { ws, accountId, token };
}

function nextMessage(ws: WSClient): Promise<any> {
  return new Promise((resolve, reject) => {
    ws.once("message", (data: Buffer) => {
      try {
        resolve(JSON.parse(data.toString()));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function waitForClose(ws: WSClient): Promise<{ code: number; reason: string }> {
  return new Promise(resolve => {
    ws.once("close", (code: number, reasonBuf: Buffer) => resolve({ code, reason: reasonBuf.toString() }));
  });
}

async function send(ws: WSClient, msg: Record<string, unknown>): Promise<any> {
  const reply = nextMessage(ws);
  ws.send(JSON.stringify(msg));
  return reply;
}

test("a handshake with no JWT is closed immediately with code 4000, no message ever accepted", async () => {
  const ws = await openSocket();
  const closed = waitForClose(ws);
  const { code, reason } = await closed;
  assert.equal(code, 4000);
  assert.equal(reason, "unauthorized");
});

test("a handshake with a tampered/invalid JWT is closed immediately with code 4000", async () => {
  const ws = await openSocket(jwtProtocol("not-a-real-jwt"));
  const { code } = await waitForClose(ws);
  assert.equal(code, 4000);
});

test("create_room with no prior group connects and returns a room code, named after the account's username", async () => {
  const { ws } = await openAuthenticatedSocket("Ana");
  const reply = await send(ws, { type: "create_room", roomName: "Sala de Ana", gameType: "impostor" });

  assert.equal(reply.type, "joined");
  assert.match(reply.roomCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  assert.equal(reply.room.hostId, reply.playerId);
  assert.equal(reply.room.players[0].name, "Ana");
  ws.close();
});

test("create_group returns a group code with no custom code accepted", async () => {
  const { ws } = await openAuthenticatedSocket("Ana");
  // Sending a `code` field (as an old client might) must be ignored, not
  // honored — the wire schema no longer has that field (see
  // packages/shared-types/index.ts).
  const reply = await send(ws, { type: "create_group", groupName: "Los pibes", code: "AAAAA" });

  assert.equal(reply.type, "group_joined");
  assert.notEqual(reply.groupCode, "AAAAA");
  assert.match(reply.groupCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  ws.close();
});

test("two rooms created back-to-back never collide on code", async () => {
  const { ws: wsA } = await openAuthenticatedSocket("Ana");
  const { ws: wsB } = await openAuthenticatedSocket("Beto");
  const [replyA, replyB] = await Promise.all([
    send(wsA, { type: "create_room", gameType: "impostor" }),
    send(wsB, { type: "create_room", gameType: "impostor" }),
  ]);

  assert.notEqual(replyA.roomCode, replyB.roomCode);
  wsA.close();
  wsB.close();
});

test("join_room with an unknown code returns an error, not a crash", async () => {
  const { ws } = await openAuthenticatedSocket("Ana");
  const reply = await send(ws, { type: "join_room", code: "ZZZZZ" });

  assert.equal(reply.type, "error");
  ws.close();
});

test("a room and a group never share the same code (shared code space)", async () => {
  const { ws: wsRoom } = await openAuthenticatedSocket("Ana");
  const { ws: wsGroup } = await openAuthenticatedSocket("Beto");
  const [roomReply, groupReply] = await Promise.all([
    send(wsRoom, { type: "create_room", gameType: "impostor" }),
    send(wsGroup, { type: "create_group", groupName: "Grupo" }),
  ]);

  assert.notEqual(roomReply.roomCode, groupReply.groupCode);
  wsRoom.close();
  wsGroup.close();
});

test("create_room/join_room use the account's username, not any client-supplied name", async () => {
  const { ws: hostWs } = await openAuthenticatedSocket("Anfitriona");
  const hostReply = await send(hostWs, { type: "create_room", gameType: "impostor" });

  const { ws: guestWs } = await openAuthenticatedSocket("Invitado");
  const guestReplyPromise = nextMessage(guestWs);
  guestWs.send(JSON.stringify({ type: "join_room", code: hostReply.roomCode, playerName: "Nombre inventado" }));
  const guestReply = await guestReplyPromise;

  assert.equal(guestReply.type, "joined");
  const guestPlayer = guestReply.room.players.find((p: any) => p.id === guestReply.playerId);
  assert.equal(guestPlayer.name, "Invitado", "the client-supplied playerName must be ignored entirely");

  hostWs.close();
  guestWs.close();
});

test("rejoin with only {roomCode} resolves the correct seat by account", async () => {
  const { ws: hostWs, token } = await openAuthenticatedSocket("Ana");
  const created = await send(hostWs, { type: "create_room", gameType: "impostor" });
  hostWs.close();
  await waitForClose(hostWs);

  const ws2 = await openSocket(jwtProtocol(token));
  const reply = await send(ws2, { type: "rejoin", roomCode: created.roomCode });

  assert.equal(reply.type, "joined");
  assert.equal(reply.playerId, created.playerId, "the same account must resolve back to the same seat");
  assert.equal(reply.room.players[0].online, true);
  ws2.close();
});

test("rejoin from an account with no seat in that room is rejected", async () => {
  const { ws: hostWs } = await openAuthenticatedSocket("Ana");
  const created = await send(hostWs, { type: "create_room", gameType: "impostor" });

  const { ws: strangerWs } = await openAuthenticatedSocket("Desconocido");
  const reply = await send(strangerWs, { type: "rejoin", roomCode: created.roomCode });

  assert.equal(reply.type, "error");
  assert.equal(reply.code, "REJOIN_FAILED");
  hostWs.close();
  strangerWs.close();
});

test("a second socket for the same account in the same room evicts the first with close code 4001", async () => {
  const { token } = registerTestAccount("Ana");
  const ws1 = await openSocket(jwtProtocol(token));
  const created = await send(ws1, { type: "create_room", gameType: "impostor" });

  const closed = waitForClose(ws1);
  const ws2 = await openSocket(jwtProtocol(token));
  await send(ws2, { type: "rejoin", roomCode: created.roomCode });

  const { code, reason } = await closed;
  assert.equal(code, 4001);
  assert.equal(reason, "session_replaced");
  ws2.close();
});
