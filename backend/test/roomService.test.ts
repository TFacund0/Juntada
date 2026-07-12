const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { rooms, clients } = require("../src/state/roomStore");
const roomService = require("../src/rooms/roomService");

// `ws` is only ever used as a Map key by roomService, so a plain object
// stands in fine for a real socket in these tests.
function fakeSocket() {
  return {};
}

beforeEach(() => {
  rooms.clear();
  clients.clear();
});

test("createRoom creates a room, registers the host and stores it in rooms", () => {
  const ws = fakeSocket();
  const { room, playerId, error } = roomService.createRoom(ws, { playerName: "Ana", roomName: "Sala de Ana" });

  assert.equal(error, undefined);
  assert.equal(room.hostId, playerId);
  assert.equal(room.players.length, 1);
  assert.equal(room.phase, "lobby");
  assert.equal(rooms.get(room.code), room);
  assert.deepEqual(clients.get(ws), { roomCode: room.code, playerId });
});

test("createRoom rejects an unknown gameType", () => {
  const { error } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "no-existe" });
  assert.match(error, /desconocido/i);
});

test("createRoom refuses once the server hits MAX_TOTAL_ROOMS", () => {
  for (let i = 0; i < 500; i++) rooms.set(`ROOM${i}`, {});
  const { error, room } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  assert.equal(room, undefined);
  assert.match(error, /lleno/i);
});

test("joinRoom adds a player to an existing lobby room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { room, playerId, error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "Beto" });

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.some((p: any) => p.id === playerId && p.name === "Beto"));
});

test("joinRoom is case-insensitive on the room code", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code.toLowerCase(), playerName: "Beto" });
  assert.equal(error, undefined);
});

test("joinRoom rejects a code that doesn't exist", () => {
  const { error } = roomService.joinRoom(fakeSocket(), { code: "ZZZZZ", playerName: "Beto" });
  assert.match(error, /no existe/i);
});

test("joinRoom rejects joining once the round has started", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  created.phase = "round";
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "Beto" });
  assert.match(error, /ya empezó/i);
});

test("joinRoom rejects a duplicate name in the same room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "ana" });
  assert.match(error, /ya está en uso/i);
});

test("joinRoom rejects once the room is at its player cap", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Host" });
  for (let i = created.players.length; i < 16; i++) {
    roomService.joinRoom(fakeSocket(), { code: created.code, playerName: `Jugador${i}` });
  }
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "Extra" });
  assert.match(error, /llena/i);
});

test("rejoinRoom marks a known player back online", () => {
  const { room: created, playerId } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  created.players[0].online = false;

  const ws2 = fakeSocket();
  const { room, error } = roomService.rejoinRoom(ws2, { roomCode: created.code, playerId });

  assert.equal(error, undefined);
  assert.equal(room.players[0].online, true);
  assert.deepEqual(clients.get(ws2), { roomCode: created.code, playerId });
});

test("rejoinRoom rejects a room that no longer exists", () => {
  const { error } = roomService.rejoinRoom(fakeSocket(), { roomCode: "ZZZZZ", playerId: "nope" });
  assert.match(error, /ya no existe/i);
});

test("rejoinRoom rejects a playerId not part of the room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { error } = roomService.rejoinRoom(fakeSocket(), { roomCode: created.code, playerId: "not-a-player" });
  assert.match(error, /Ya no formás parte/i);
});

test("kickPlayer removes the player from the room", () => {
  const { room } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.kickPlayer(room, betoId);
  assert.equal(room.players.length, 1);
  assert.ok(!room.players.some((p: any) => p.id === betoId));
});

test("kickPlayer hands the host role off when the host itself is kicked", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.kickPlayer(room, hostId);
  assert.equal(room.hostId, betoId);
});

test("markOffline flags the player offline and hands off host if needed", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.markOffline(room, hostId);
  assert.equal(room.players.find((p: any) => p.id === hostId).online, false);
  assert.equal(room.hostId, betoId);
});

test("isRoomFullyOffline is true only once every player is offline", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.markOffline(room, hostId);
  assert.equal(roomService.isRoomFullyOffline(room), false);

  roomService.markOffline(room, betoId);
  assert.equal(roomService.isRoomFullyOffline(room), true);
});

test("scheduleRoomCleanup deletes a fully-offline room once the grace period elapses", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, playerId } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  roomService.markOffline(room, playerId);

  roomService.scheduleRoomCleanup(room.code);
  assert.equal(rooms.has(room.code), true);

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(rooms.has(room.code), false);
});

test("scheduleRoomCleanup leaves the room alone if someone reconnected in time", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, playerId } = roomService.createRoom(fakeSocket(), { playerName: "Ana" });
  roomService.markOffline(room, playerId);
  roomService.scheduleRoomCleanup(room.code);

  roomService.rejoinRoom(fakeSocket(), { roomCode: room.code, playerId });

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(rooms.has(room.code), true);
});
