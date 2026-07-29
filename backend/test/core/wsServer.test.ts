// ─── WS Server Integration Test ─────────────────────────────────────────────
// Unlike the other test/*.test.ts files, which call the room/group services
// directly with a fake socket, this one boots the real HTTP+WebSocket server
// (see src/app.ts, built specifically to be importable without binding a
// port) and drives it with a real `ws` client over an actual ephemeral port.
// It exists because a real bug (creating a standalone room without ever
// having created a group failed client-side) went unnoticed by the
// service-level tests, which never touch the actual WS wire protocol.

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
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

function openSocket(): Promise<WSClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
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

async function send(ws: WSClient, msg: Record<string, unknown>): Promise<any> {
  const reply = nextMessage(ws);
  ws.send(JSON.stringify(msg));
  return reply;
}

test("create_room with no prior group connects and returns a room code", async () => {
  const ws = await openSocket();
  const reply = await send(ws, { type: "create_room", playerName: "Ana", roomName: "Sala de Ana", gameType: "impostor" });

  assert.equal(reply.type, "joined");
  assert.match(reply.roomCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  assert.equal(reply.room.hostId, reply.playerId);
  ws.close();
});

test("create_group returns a group code with no custom code accepted", async () => {
  const ws = await openSocket();
  // Sending a `code` field (as an old client might) must be ignored, not
  // honored — the wire schema no longer has that field (see
  // packages/shared-types/index.ts).
  const reply = await send(ws, { type: "create_group", playerName: "Ana", groupName: "Los pibes", code: "AAAAA" });

  assert.equal(reply.type, "group_joined");
  assert.notEqual(reply.groupCode, "AAAAA");
  assert.match(reply.groupCode, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  ws.close();
});

test("two rooms created back-to-back never collide on code", async () => {
  const wsA = await openSocket();
  const wsB = await openSocket();
  const [replyA, replyB] = await Promise.all([
    send(wsA, { type: "create_room", playerName: "Ana", gameType: "impostor" }),
    send(wsB, { type: "create_room", playerName: "Beto", gameType: "impostor" }),
  ]);

  assert.notEqual(replyA.roomCode, replyB.roomCode);
  wsA.close();
  wsB.close();
});

test("join_room with an unknown code returns an error, not a crash", async () => {
  const ws = await openSocket();
  const reply = await send(ws, { type: "join_room", code: "ZZZZZ", playerName: "Ana" });

  assert.equal(reply.type, "error");
  ws.close();
});

test("a room and a group never share the same code (shared code space)", async () => {
  const wsRoom = await openSocket();
  const wsGroup = await openSocket();
  const [roomReply, groupReply] = await Promise.all([
    send(wsRoom, { type: "create_room", playerName: "Ana", gameType: "impostor" }),
    send(wsGroup, { type: "create_group", playerName: "Beto", groupName: "Grupo" }),
  ]);

  assert.notEqual(roomReply.roomCode, groupReply.groupCode);
  wsRoom.close();
  wsGroup.close();
});
