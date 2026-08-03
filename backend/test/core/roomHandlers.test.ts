// ─── ws/roomHandlers.ts: kickPlayer ──────────────────────────────────────────
// A host kicking themselves used to be the one way a standalone room's kick
// flow could empty room.players entirely without any socket ever going
// through handleDisconnect — the only path that schedules the room's own
// cleanup grace timer — leaving it orphaned in `rooms` forever.

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { rooms, clients } = require("../../src/state/roomStore");
const roomHandlers = require("../../src/ws/roomHandlers");
const roomService = require("../../src/rooms/roomService");
const { fakeSocket } = require("../testUtils");

beforeEach(() => {
  rooms.clear();
  clients.clear();
});

test("kickPlayer ignores a host targeting their own playerId instead of emptying the room", () => {
  const hostWs = fakeSocket();
  const { room, playerId: hostId } = roomService.createRoom(hostWs, { playerName: "Ana", gameType: "impostor" });

  roomHandlers.kickPlayer(hostWs, { type: "kick_player", targetId: hostId }, clients.get(hostWs));

  assert.equal(room.players.length, 1, "the host should still be in their own room");
  assert.equal(rooms.has(room.code), true, "the room should still exist, not be silently orphaned");
});

test("kickPlayer still lets the host remove someone else as usual", () => {
  const hostWs = fakeSocket();
  const { room } = roomService.createRoom(hostWs, { playerName: "Ana", gameType: "impostor" });
  const targetWs = fakeSocket();
  const { playerId: targetId } = roomService.joinRoom(targetWs, { code: room.code, playerName: "Beto" });

  roomHandlers.kickPlayer(hostWs, { type: "kick_player", targetId }, clients.get(hostWs));

  assert.equal(room.players.length, 1);
  assert.ok(!room.players.some((p: any) => p.id === targetId));
  assert.equal(rooms.has(room.code), true);
});
