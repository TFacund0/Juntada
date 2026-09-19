// ─── ws/groupHandlers.ts: createInstance / joinInstance ─────────────────────
// Covers the handler-level wiring for the account-eviction fix in
// roomService.createInstanceRoom/joinInstanceRoom (see roomService.test.ts
// for the service-level behavior) — confirms groupHandlers actually forwards
// the real `ws` through, not just that the service function works in
// isolation.

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { rooms, groups, clients, activeSockets, accountSockets } = require("../../src/state/roomStore");
const groupHandlers = require("../../src/ws/groupHandlers");
const groupService = require("../../src/rooms/groupService");
const { fakeSocket } = require("../testUtils");

beforeEach(() => {
  rooms.clear();
  groups.clear();
  clients.clear();
  activeSockets.clear();
  accountSockets.clear();
});

test("createInstance evicts the member's previous socket in the new room's scope", () => {
  const hostWs = fakeSocket();
  const { group, playerId: hostId } = groupService.createGroup(hostWs, { accountId: "acc-ana", username: "Ana" });

  let closedCode: number | undefined;
  const staleWs = {
    close: (code: number) => {
      closedCode = code;
    },
  };
  clients.set(staleWs, clients.get(hostWs));

  groupHandlers.createInstance(staleWs, { type: "create_instance", gameType: "impostor" }, clients.get(staleWs));

  const newWs = fakeSocket();
  clients.set(newWs, { groupCode: group.code, roomCode: null, playerId: hostId, accountId: "acc-ana" });
  const room = [...rooms.values()][0];
  groupHandlers.joinInstance(newWs, { type: "join_instance", roomCode: room.code }, clients.get(newWs));

  assert.equal(closedCode, 4001, "the stale socket from create_instance should be evicted by the later join_instance");
  assert.equal(activeSockets.get(hostId), newWs);
});

test("joinInstance reuses the member's existing playerId and links the socket to the instance's room scope", () => {
  const hostWs = fakeSocket();
  const { group } = groupService.createGroup(hostWs, { accountId: "acc-ana", username: "Ana" });
  groupHandlers.createInstance(hostWs, { type: "create_instance", gameType: "impostor" }, clients.get(hostWs));
  const room = [...rooms.values()][0];

  const betoWs = fakeSocket();
  const { playerId: betoId } = groupService.joinGroup(betoWs, { code: group.code, accountId: "acc-beto", username: "Beto" });

  groupHandlers.joinInstance(betoWs, { type: "join_instance", roomCode: room.code }, clients.get(betoWs));

  assert.equal(room.players.length, 2);
  assert.ok(room.players.some((p: any) => p.id === betoId && p.accountId === "acc-beto"));
  assert.deepEqual(clients.get(betoWs), { groupCode: group.code, roomCode: room.code, playerId: betoId, accountId: "acc-beto" });
  assert.equal(activeSockets.get(betoId), betoWs);
});
