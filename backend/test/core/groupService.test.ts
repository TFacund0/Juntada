const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { groups, clients } = require("../../src/state/roomStore");
const groupService = require("../../src/rooms/groupService");
const { fakeSocket } = require("../testUtils");

beforeEach(() => {
  groups.clear();
  clients.clear();
});

test("createGroup creates a group, registers the host and stores it in groups", () => {
  const ws = fakeSocket();
  const { group, playerId, error } = groupService.createGroup(ws, { accountId: "acc-ana", username: "Ana", groupName: "Los pibes" });

  assert.equal(error, undefined);
  assert.equal(group.hostId, playerId);
  assert.equal(group.members.length, 1);
  assert.equal(group.members[0].name, "Ana");
  assert.equal(group.members[0].accountId, "acc-ana");
  assert.equal(group.members[0].online, true);
  assert.equal(groups.get(group.code), group);
  assert.deepEqual(clients.get(ws), { groupCode: group.code, roomCode: null, playerId, accountId: "acc-ana" });
});

test("createGroup refuses once the server hits MAX_TOTAL_GROUPS", () => {
  for (let i = 0; i < 500; i++) groups.set(`GRP${i}`, {});
  const { error, group } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  assert.equal(group, undefined);
  assert.match(error, /lleno/i);
});

test("joinGroup adds a member to an existing group", () => {
  const { group: created } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  const { group, playerId, error } = groupService.joinGroup(fakeSocket(), { code: created.code, accountId: "acc-beto", username: "Beto" });

  assert.equal(error, undefined);
  assert.equal(group.members.length, 2);
  assert.ok(group.members.some((m: any) => m.id === playerId && m.name === "Beto" && m.accountId === "acc-beto"));
});

test("joinGroup rejects a code that doesn't exist", () => {
  const { error } = groupService.joinGroup(fakeSocket(), { code: "ZZZZZ", accountId: "acc-beto", username: "Beto" });
  assert.match(error, /no existe/i);
});

// Duplicate-name rejection is gone: usernames are unique at the account
// level now, so two accounts landing on the same rendered name on their own
// devices is no longer a collision worth blocking (see design.md).
test("joinGroup allows two different accounts even if their usernames happen to render the same", () => {
  const { group: created } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  const { error } = groupService.joinGroup(fakeSocket(), { code: created.code, accountId: "acc-ana2", username: "Ana" });
  assert.equal(error, undefined);
});

test("joinGroup rejects once the group is at its member cap", () => {
  const { group: created } = groupService.createGroup(fakeSocket(), { accountId: "acc-host", username: "Host" });
  for (let i = created.members.length; i < 16; i++) {
    groupService.joinGroup(fakeSocket(), { code: created.code, accountId: `acc-${i}`, username: `Miembro${i}` });
  }
  const { error } = groupService.joinGroup(fakeSocket(), { code: created.code, accountId: "acc-extra", username: "Extra" });
  assert.match(error, /lleno/i);
});

test("rejoinGroup marks a known member back online, resolved by accountId", () => {
  const { group: created, playerId } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  created.members[0].online = false;

  const ws2 = fakeSocket();
  const { group, error } = groupService.rejoinGroup(ws2, { groupCode: created.code, accountId: "acc-ana" });

  assert.equal(error, undefined);
  assert.equal(group.members[0].online, true);
  assert.deepEqual(clients.get(ws2), { groupCode: created.code, roomCode: null, playerId, accountId: "acc-ana" });
});

test("rejoinGroup rejects a group that no longer exists", () => {
  const { error } = groupService.rejoinGroup(fakeSocket(), { groupCode: "ZZZZZ", accountId: "nope" });
  assert.match(error, /ya no existe/i);
});

test("rejoinGroup rejects an account with no membership in the group", () => {
  const { group: created } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  const { error } = groupService.rejoinGroup(fakeSocket(), { groupCode: created.code, accountId: "not-a-member" });
  assert.match(error, /Ya no formás parte/i);
});

test("leaveGroup removes the member and hands off host if needed", () => {
  const { group, playerId: hostId } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  const { playerId: betoId } = groupService.joinGroup(fakeSocket(), { code: group.code, accountId: "acc-beto", username: "Beto" });

  groupService.leaveGroup(group, hostId);
  assert.equal(group.members.length, 1);
  assert.equal(group.hostId, betoId);
});

test("markMemberOffline/isGroupFullyOffline track online status across members", () => {
  const { group, playerId: hostId } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  const { playerId: betoId } = groupService.joinGroup(fakeSocket(), { code: group.code, accountId: "acc-beto", username: "Beto" });

  groupService.markMemberOffline(group, hostId);
  assert.equal(groupService.isGroupFullyOffline(group), false);

  groupService.markMemberOffline(group, betoId);
  assert.equal(groupService.isGroupFullyOffline(group), true);
});

test("scheduleGroupCleanup deletes a fully-offline group once the grace period elapses", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { group, playerId } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  groupService.markMemberOffline(group, playerId);

  groupService.scheduleGroupCleanup(group.code);
  assert.equal(groups.has(group.code), true);

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(groups.has(group.code), false);
});

test("scheduleGroupCleanup leaves the group alone if someone reconnected in time", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { group, playerId } = groupService.createGroup(fakeSocket(), { accountId: "acc-ana", username: "Ana" });
  groupService.markMemberOffline(group, playerId);
  groupService.scheduleGroupCleanup(group.code);

  groupService.rejoinGroup(fakeSocket(), { groupCode: group.code, accountId: "acc-ana" });

  t.mock.timers.tick(5 * 60 * 1000);
  assert.equal(groups.has(group.code), true);
});
