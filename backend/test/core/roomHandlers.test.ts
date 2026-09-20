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
  const { room, playerId: hostId } = roomService.createRoom(hostWs, { accountId: "acc-ana", username: "Ana", gameType: "impostor" });

  roomHandlers.kickPlayer(hostWs, { type: "kick_player", targetId: hostId }, clients.get(hostWs));

  assert.equal(room.players.length, 1, "the host should still be in their own room");
  assert.equal(rooms.has(room.code), true, "the room should still exist, not be silently orphaned");
});

test("kickPlayer still lets the host remove someone else as usual", () => {
  const hostWs = fakeSocket();
  const { room } = roomService.createRoom(hostWs, { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const targetWs = fakeSocket();
  const { playerId: targetId } = roomService.joinRoom(targetWs, { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomHandlers.kickPlayer(hostWs, { type: "kick_player", targetId }, clients.get(hostWs));

  assert.equal(room.players.length, 1);
  assert.ok(!room.players.some((p: any) => p.id === targetId));
  assert.equal(rooms.has(room.code), true);
});

// ─── ws/roomHandlers.ts: leaveRoom ───────────────────────────────────────────
// The no-group counterpart of groupHandlers.leaveInstance — a player leaving
// a standalone room mid-match on their own, right away instead of waiting
// out the offline-kick grace period.

test("leaveRoom removes the leaving player immediately and lets the rest of the room keep going", () => {
  const hostWs = fakeSocket();
  const { room } = roomService.createRoom(hostWs, { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const targetWs = fakeSocket();
  const { playerId: targetId } = roomService.joinRoom(targetWs, { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomHandlers.leaveRoom(targetWs, { type: "leave_room" }, clients.get(targetWs));

  assert.equal(room.players.length, 1);
  assert.ok(!room.players.some((p: any) => p.id === targetId));
  assert.equal(rooms.has(room.code), true, "the room stays open for whoever's left");
  assert.deepEqual(clients.get(targetWs), { groupCode: null, roomCode: null, playerId: null, accountId: "acc-beto" });
});

test("leaveRoom hands the host role off when the host itself leaves", () => {
  const hostWs = fakeSocket();
  const { room, playerId: hostId } = roomService.createRoom(hostWs, { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const betoWs = fakeSocket();
  const { playerId: betoId } = roomService.joinRoom(betoWs, { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomHandlers.leaveRoom(hostWs, { type: "leave_room" }, clients.get(hostWs));

  assert.equal(room.hostId, betoId);
  assert.ok(!room.players.some((p: any) => p.id === hostId));
});

test("leaveRoom closes the room once the last player leaves", () => {
  const hostWs = fakeSocket();
  const { room } = roomService.createRoom(hostWs, { accountId: "acc-ana", username: "Ana", gameType: "impostor" });

  roomHandlers.leaveRoom(hostWs, { type: "leave_room" }, clients.get(hostWs));

  assert.equal(rooms.has(room.code), false);
});
