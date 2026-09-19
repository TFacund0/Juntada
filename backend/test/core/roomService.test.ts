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
  const { room, playerId, error } = roomService.createRoom(ws, {
    accountId: "acc-ana",
    username: "Ana",
    roomName: "Sala de Ana",
    gameType: "impostor",
  });

  assert.equal(error, undefined);
  assert.equal(room.hostId, playerId);
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].accountId, "acc-ana");
  assert.equal(room.phase, "lobby");
  assert.equal(room.gameType, "impostor");
  assert.equal(room.groupCode, null);
  assert.equal(rooms.get(room.code), room);
  assert.deepEqual(clients.get(ws), { groupCode: null, roomCode: room.code, playerId, accountId: "acc-ana" });
});

test("createRoom rejects an unknown gameType", () => {
  const { error } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "no-existe" });
  assert.match(error, /desconocido/i);
});

test("createRoom refuses once the server hits MAX_TOTAL_ROOMS", () => {
  for (let i = 0; i < 500; i++) rooms.set(`ROOM${i}`, {});
  const { error, room } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  assert.equal(room, undefined);
  assert.match(error, /lleno/i);
});

test("createInstanceRoom links the new room back to the group and reuses the given identity", () => {
  const { room } = roomService.createInstanceRoom("GRUPO1", "impostor", "host-id", "acc-ana", "Ana", "Grupo de Ana");

  assert.equal(room.groupCode, "GRUPO1");
  assert.equal(room.gameType, "impostor");
  assert.equal(room.hostId, "host-id");
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].id, "host-id");
  assert.equal(room.players[0].accountId, "acc-ana");
  assert.equal(room.players[0].name, "Ana");
  assert.equal(room.name, "Grupo de Ana");
  assert.equal(rooms.get(room.code), room);
});

test("createInstanceRoom rejects an unknown gameType", () => {
  const { error } = roomService.createInstanceRoom("GRUPO1", "no-existe", "host-id", "acc-ana", "Ana", "Grupo de Ana");
  assert.match(error, /desconocido/i);
});

test("joinRoom adds a player to an existing lobby room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { room, playerId, error } = roomService.joinRoom(fakeSocket(), { code: created.code, accountId: "acc-beto", username: "Beto" });

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.some((p: any) => p.id === playerId && p.name === "Beto" && p.accountId === "acc-beto"));
});

test("joinRoom is case-insensitive on the room code", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code.toLowerCase(), accountId: "acc-beto", username: "Beto" });
  assert.equal(error, undefined);
});

test("joinRoom rejects a code that doesn't exist", () => {
  const { error } = roomService.joinRoom(fakeSocket(), { code: "ZZZZZ", accountId: "acc-beto", username: "Beto" });
  assert.match(error, /no existe/i);
});

test("joinRoom holds a joiner in waitingPlayers once the round has started, instead of rejecting them", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  created.phase = "round";
  const { room, playerId, waiting, error } = roomService.joinRoom(fakeSocket(), {
    code: created.code,
    accountId: "acc-beto",
    username: "Beto",
  });
  assert.equal(error, undefined);
  assert.equal(waiting, true);
  assert.equal(
    room.players.some((p: { id: string }) => p.id === playerId),
    false,
  );
  assert.equal(
    room.waitingPlayers.some((p: { id: string }) => p.id === playerId),
    true,
  );
});

test("joinRoom moves a waiting joiner into players once the room is back in the lobby", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  created.phase = "round";
  const { playerId } = roomService.joinRoom(fakeSocket(), { code: created.code, accountId: "acc-beto", username: "Beto" });
  created.phase = "lobby";
  roomService.flushWaitingPlayers(created);
  assert.equal(created.waitingPlayers.length, 0);
  assert.equal(
    created.players.some((p: { id: string }) => p.id === playerId),
    true,
  );
});

// Duplicate-name rejection is gone: usernames are unique at the account
// level (see design.md), so two different accounts can share a display name
// on their own devices but never collide once each has a real, unique
// username — the wire-level identity now comes from the account, not a
// free-form name.
test("joinRoom allows two different accounts to join even if their usernames happen to render the same", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, accountId: "acc-ana2", username: "Ana" });
  assert.equal(error, undefined);
});

test("joinRoom rejects once the room is at its player cap", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-host", username: "Host", gameType: "impostor" });
  for (let i = created.players.length; i < 16; i++) {
    roomService.joinRoom(fakeSocket(), { code: created.code, accountId: `acc-${i}`, username: `Jugador${i}` });
  }
  const { error } = roomService.joinRoom(fakeSocket(), { code: created.code, accountId: "acc-extra", username: "Extra" });
  assert.match(error, /llena/i);
});

test("joinInstanceRoom reuses the given playerId instead of minting a new one", () => {
  const { room: created } = roomService.createInstanceRoom("GRUPO1", "impostor", "host-id", "acc-ana", "Ana", "Grupo de Ana");
  const { room, error } = roomService.joinInstanceRoom(created.code, "member-2", "acc-beto", "Beto");

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
  assert.ok(room.players.some((p: any) => p.id === "member-2" && p.name === "Beto" && p.accountId === "acc-beto"));
});

test("joinInstanceRoom is idempotent when the player already joined", () => {
  const { room: created } = roomService.createInstanceRoom("GRUPO1", "impostor", "host-id", "acc-ana", "Ana", "Grupo de Ana");
  roomService.joinInstanceRoom(created.code, "member-2", "acc-beto", "Beto");
  const { room, error } = roomService.joinInstanceRoom(created.code, "member-2", "acc-beto", "Beto");

  assert.equal(error, undefined);
  assert.equal(room.players.length, 2);
});

test("joinInstanceRoom rejects a room that no longer exists", () => {
  const { error } = roomService.joinInstanceRoom("ZZZZZ", "member-2", "acc-beto", "Beto");
  assert.match(error, /ya no existe/i);
});

test("rejoinRoom marks a known player back online, resolved by accountId", () => {
  const { room: created, playerId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  created.players[0].online = false;

  const ws2 = fakeSocket();
  const { room, error } = roomService.rejoinRoom(ws2, { roomCode: created.code, accountId: "acc-ana" });

  assert.equal(error, undefined);
  assert.equal(room.players[0].online, true);
  assert.deepEqual(clients.get(ws2), { groupCode: null, roomCode: created.code, playerId, accountId: "acc-ana" });
});

test("rejoinRoom rejects a room that no longer exists", () => {
  const { error } = roomService.rejoinRoom(fakeSocket(), { roomCode: "ZZZZZ", accountId: "nope" });
  assert.match(error, /ya no existe/i);
});

test("rejoinRoom rejects an account with no seat in the room", () => {
  const { room: created } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { error } = roomService.rejoinRoom(fakeSocket(), { roomCode: created.code, accountId: "not-a-player" });
  assert.match(error, /Ya no formás parte/i);
});

test("a second socket for the same account in the same room evicts the first with close code 4001", () => {
  const { room: created, playerId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  created.players[0].online = false;

  let closedCode: number | undefined;
  const staleWs = {
    close: (code: number) => {
      closedCode = code;
    },
  };
  // Simulate the first socket still being "active" for this account by
  // rejoining with it first, then a second device rejoining right after.
  roomService.rejoinRoom(staleWs, { roomCode: created.code, accountId: "acc-ana" });
  roomService.rejoinRoom(fakeSocket(), { roomCode: created.code, accountId: "acc-ana" });

  assert.equal(closedCode, 4001);
  assert.equal(playerId, created.players[0].id, "the seat itself never changes, only which socket owns it");
});

test("kickPlayer removes the player from the room", () => {
  const { room } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomService.kickPlayer(room, betoId);
  assert.equal(room.players.length, 1);
  assert.ok(!room.players.some((p: any) => p.id === betoId));
});

test("kickPlayer hands the host role off when the host itself is kicked", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomService.kickPlayer(room, hostId);
  assert.equal(room.hostId, betoId);
});

test("removePlayer removes the player and hands off host if needed, just like a voluntary leave", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomService.removePlayer(room, hostId);
  assert.equal(room.players.length, 1);
  assert.equal(room.hostId, betoId);
});

test("markOffline flags the player offline but keeps them as host (only kicking hands it off)", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  roomService.joinRoom(fakeSocket(), { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomService.markOffline(room, hostId);
  assert.equal(room.players.find((p: any) => p.id === hostId).online, false);
  // A brief disconnect (about to reconnect) shouldn't cost the host their
  // role — only an actual removal (kick, or the 5-minute auto-kick timeout)
  // should. See kickPlayer's own reassignment test for that path.
  assert.equal(room.hostId, hostId);
});

test("isRoomFullyOffline is true only once every player is offline", () => {
  const { room, playerId: hostId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  const { playerId: betoId } = roomService.joinRoom(fakeSocket(), { code: room.code, accountId: "acc-beto", username: "Beto" });

  roomService.markOffline(room, hostId);
  assert.equal(roomService.isRoomFullyOffline(room), false);

  roomService.markOffline(room, betoId);
  assert.equal(roomService.isRoomFullyOffline(room), true);
});

test("scheduleRoomCleanup deletes a fully-offline room once the grace period elapses", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, playerId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  roomService.markOffline(room, playerId);

  roomService.scheduleRoomCleanup(room.code);
  assert.equal(rooms.has(room.code), true);

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(rooms.has(room.code), false);
});

test("scheduleRoomCleanup leaves the room alone if someone reconnected in time", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, playerId } = roomService.createRoom(fakeSocket(), { accountId: "acc-ana", username: "Ana", gameType: "impostor" });
  roomService.markOffline(room, playerId);
  roomService.scheduleRoomCleanup(room.code);

  roomService.rejoinRoom(fakeSocket(), { roomCode: room.code, accountId: "acc-ana" });

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(rooms.has(room.code), true);
});
