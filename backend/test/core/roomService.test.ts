const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { rooms, clients } = require("../../src/state/roomStore");
const roomService = require("../../src/rooms/roomService");
const { fakeSocket } = require("../testUtils");

beforeEach(() => {
  rooms.clear();
  clients.clear();
});

test("createRoom creates a room, registers the host and stores it in rooms", () => {
  const ws = fakeSocket();
  const { room, playerId, error } = roomService.createRoom(ws, { playerName: "Ana", roomName: "Sala de Ana", gameType: "impostor" });

  assert.equal(error, undefined);
  assert.equal(room.hostId, playerId);
  assert.equal(room.players.length, 1);
  assert.equal(room.phase, "lobby");
  assert.equal(room.gameType, "impostor");
  assert.equal(room.groupCode, null);
  assert.equal(rooms.get(room.code), room);
  assert.deepEqual(clients.get(ws), { groupCode: null, roomCode: room.code, playerId });
});

test("createRoom rejects an unknown gameType", () => {
  const { error } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "no-existe" });
  assert.match(error, /desconocido/i);
});

test("createRoom refuses once the server hits MAX_TOTAL_ROOMS", () => {
  for (let i = 0; i < 500; i++) rooms.set(`ROOM${i}`, {});
  const { error, room } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  assert.equal(room, undefined);
  assert.match(error, /lleno/i);
});

test("createInstanceRoom links the new room back to the group and reuses the given identity", () => {
  const { room } = roomService.createInstanceRoom("GRUPO1", "impostor", "host-id", "Ana", "Grupo de Ana");

  assert.equal(room.groupCode, "GRUPO1");
  assert.equal(room.gameType, "impostor");
  assert.equal(room.hostId, "host-id");
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].id, "host-id");
  assert.equal(room.players[0].name, "Ana");
  assert.equal(room.name, "Grupo de Ana");
  assert.equal(rooms.get(room.code), room);
});

test("createInstanceRoom rejects an unknown gameType", () => {
  const { error } = roomService.createInstanceRoom("GRUPO1", "no-existe", "host-id", "Ana", "Grupo de Ana");
  assert.match(error, /desconocido/i);
});

test("joinRoom adds a player to an existing lobby room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { room, playerId, error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "Beto" });

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.some((p: any) => p.id === playerId && p.name === "Beto"));
});

test("joinRoom is case-insensitive on the room code", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code.toLowerCase(), playerName: "Beto" });
  assert.equal(error, undefined);
});

test("joinRoom rejects a code that doesn't exist", () => {
  const { error } = roomService.joinRoom(fakeSocket(), { code: "ZZZZZ", playerName: "Beto" });
  assert.match(error, /no existe/i);
});

test("joinRoom rejects joining once the round has started", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  created.phase = "round";
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "Beto" });
  assert.match(error, /ya empezó/i);
});

test("joinRoom rejects a duplicate name in the same room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "ana" });
  assert.match(error, /ya está en uso/i);
});

test("joinRoom rejects once the room is at its player cap", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Host", gameType: "impostor" });
  for (let i = created.players.length; i < 16; i++) {
    roomService.joinRoom(fakeSocket(), { code: created.code, playerName: `Jugador${i}` });
  }
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, playerName: "Extra" });
  assert.match(error, /llena/i);
});

test("joinInstanceRoom reuses the given playerId instead of minting a new one", () => {
  const { room: created } = roomService.createInstanceRoom("GRUPO1", "impostor", "host-id", "Ana", "Grupo de Ana");
  const { room, error } = roomService.joinInstanceRoom(created.code, "member-2", "Beto");

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.some((p: any) => p.id === "member-2" && p.name === "Beto"));
});

test("joinInstanceRoom is idempotent when the player already joined", () => {
  const { room: created } = roomService.createInstanceRoom("GRUPO1", "impostor", "host-id", "Ana", "Grupo de Ana");
  roomService.joinInstanceRoom(created.code, "member-2", "Beto");
  const { room, error } = roomService.joinInstanceRoom(created.code, "member-2", "Beto");

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
});

test("joinInstanceRoom rejects a room that no longer exists", () => {
  const { error } = roomService.joinInstanceRoom("ZZZZZ", "member-2", "Beto");
  assert.match(error, /ya no existe/i);
});

test("rejoinRoom marks a known player back online", () => {
  const { room: created, playerId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  created.players[0].online = false;

  const ws2 = fakeSocket();
  const { room, error } = roomService.rejoinRoom(ws2, { roomCode: created.code, playerId });

  assert.equal(error, undefined);
  assert.equal(room.players[0].online, true);
  assert.deepEqual(clients.get(ws2), { groupCode: null, roomCode: created.code, playerId });
});

test("rejoinRoom rejects a room that no longer exists", () => {
  const { error } = roomService.rejoinRoom(fakeSocket(), { roomCode: "ZZZZZ", playerId: "nope" });
  assert.match(error, /ya no existe/i);
});

test("rejoinRoom rejects a playerId not part of the room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { error } = roomService.rejoinRoom(fakeSocket(), { roomCode: created.code, playerId: "not-a-player" });
  assert.match(error, /Ya no formás parte/i);
});

test("kickPlayer removes the player from the room", () => {
  const { room } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.kickPlayer(room, betoId);
  assert.equal(room.players.length, 1);
  assert.ok(!room.players.some((p: any) => p.id === betoId));
});

test("kickPlayer hands the host role off when the host itself is kicked", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.kickPlayer(room, hostId);
  assert.equal(room.hostId, betoId);
});

test("removePlayer removes the player and hands off host if needed, just like a voluntary leave", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.removePlayer(room, hostId);
  assert.equal(room.players.length, 1);
  assert.equal(room.hostId, betoId);
});

test("markOffline flags the player offline but keeps them as host (only kicking hands it off)", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.markOffline(room, hostId);
  assert.equal(room.players.find((p: any) => p.id === hostId).online, false);
  // A brief disconnect (about to reconnect) shouldn't cost the host their
  // role — only an actual removal (kick, or the 5-minute auto-kick timeout)
  // should. See kickPlayer's own reassignment test for that path.
  assert.equal(room.hostId, hostId);
});

test("isRoomFullyOffline is true only once every player is offline", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });

  roomService.markOffline(room, hostId);
  assert.equal(roomService.isRoomFullyOffline(room), false);

  roomService.markOffline(room, betoId);
  assert.equal(roomService.isRoomFullyOffline(room), true);
});

test("scheduleRoomCleanup deletes a fully-offline room once the grace period elapses", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, playerId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  roomService.markOffline(room, playerId);

  roomService.scheduleRoomCleanup(room.code);
  assert.equal(rooms.has(room.code), true);

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(rooms.has(room.code), false);
});

test("scheduleRoomCleanup leaves the room alone if someone reconnected in time", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, playerId } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "impostor" });
  roomService.markOffline(room, playerId);
  roomService.scheduleRoomCleanup(room.code);

  roomService.rejoinRoom(fakeSocket(), { roomCode: room.code, playerId });

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(rooms.has(room.code), true);
});
