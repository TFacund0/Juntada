const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/ruleta/engine");

interface TestPlayer {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
}
interface TestRoom {
  code: string;
  hostId: string;
  players: TestPlayer[];
  config: Record<string, any>;
  round: any;
  usedWords: Record<string, unknown>;
  roundHistory: any[];
  phase?: string;
}

function makeRoom(overrides: Partial<TestRoom> = {}): TestRoom {
  return {
    code: "TEST1",
    hostId: "p1",
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
    ...overrides,
  };
}

function withEntries(room: TestRoom, count: number, mode: "keep" | "eliminate" = "eliminate"): TestRoom {
  room.config.mode = mode;
  room.config.entries = Array.from({ length: count }, (_, i) => ({ id: `e${i}`, name: `Entrada ${i}`, description: "" }));
  return room;
}

test("startRound refuses with fewer than 2 entries", () => {
  const room = withEntries(makeRoom(), 1);
  const res = engine.startRound(room);
  assert.ok(res.error);
  assert.equal(room.round, null);
});

test("startRound loads the pool from config and enters phase 'round'", () => {
  const room = withEntries(makeRoom(), 3);
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "round");
  assert.equal(room.round.pool.length, 3);
  assert.equal(room.round.rotation, 0);
  assert.equal(room.round.result, null);
  assert.deepEqual(room.round.eliminated, []);
});

test("spin is host-only", () => {
  const room = withEntries(makeRoom(), 3);
  engine.startRound(room);
  const res = engine.handleAction(room, "p2", "spin", {});
  assert.equal(res.handled, false);
  assert.equal(room.round.result, null);
});

test("spin picks a result from the pool and advances the rotation forward", () => {
  const room = withEntries(makeRoom(), 4);
  engine.startRound(room);
  const res = engine.handleAction(room, "p1", "spin", {});
  assert.equal(res.handled, true);
  assert.ok(room.round.pool.some((e: any) => e.id === room.round.result.id));
  assert.ok(room.round.rotation > 0);
  assert.ok(room.round.spinAt);
});

test("spin is rejected while a result is already pending (not yet confirmed/spun again)", () => {
  const room = withEntries(makeRoom(), 3);
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  const firstResult = room.round.result;

  const res = engine.handleAction(room, "p1", "spin", {});
  assert.equal(res.handled, false);
  assert.equal(room.round.result, firstResult);
});

test("spin is rejected once the pool is down to 1 entry", () => {
  const room = withEntries(makeRoom(), 2);
  engine.startRound(room);
  room.round.pool = [room.round.pool[0]];
  const res = engine.handleAction(room, "p1", "spin", {});
  assert.equal(res.handled, false);
});

test("confirm_eliminate removes the spun entry from the pool and clears the result", () => {
  const room = withEntries(makeRoom(), 3, "eliminate");
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  const spunId = room.round.result.id;

  const res = engine.handleAction(room, "p1", "confirm_eliminate", {});
  assert.equal(res.handled, true);
  assert.equal(room.round.pool.length, 2);
  assert.ok(!room.round.pool.some((e: any) => e.id === spunId));
  assert.equal(room.round.eliminated.length, 1);
  assert.equal(room.round.eliminated[0].id, spunId);
  assert.equal(room.round.result, null);
  assert.equal(room.round.spinAt, null);
});

test("confirm_eliminate down to the last entry moves the room to phase 'result'", () => {
  const room = withEntries(makeRoom(), 2, "eliminate");
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  engine.handleAction(room, "p1", "confirm_eliminate", {});

  assert.equal(room.phase, "result");
  assert.equal(room.round.pool.length, 1);
});

test("confirm_eliminate is rejected in 'keep' mode", () => {
  const room = withEntries(makeRoom(), 3, "keep");
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  const res = engine.handleAction(room, "p1", "confirm_eliminate", {});
  assert.equal(res.handled, false);
  assert.equal(room.round.pool.length, 3);
});

test("confirm_eliminate is rejected without a pending result", () => {
  const room = withEntries(makeRoom(), 3, "eliminate");
  engine.startRound(room);
  const res = engine.handleAction(room, "p1", "confirm_eliminate", {});
  assert.equal(res.handled, false);
});

test("spin_again tallies the result's count and clears it, keeping the full pool", () => {
  const room = withEntries(makeRoom(), 3, "keep");
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  const spunId = room.round.result.id;

  const res = engine.handleAction(room, "p1", "spin_again", {});
  assert.equal(res.handled, true);
  assert.equal(room.round.counts[spunId], 1);
  assert.equal(room.round.result, null);
  assert.equal(room.round.pool.length, 3);
  assert.equal(room.phase, "round");
});

test("spin_again accumulates counts across repeated spins of the same entry", () => {
  // Stubbed to always pick index 0, so both spins land on the same entry —
  // spin itself requires a pool of at least 2 (see the pool.length guard),
  // so a 1-entry pool isn't an option for forcing determinism here.
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    const room = withEntries(makeRoom(), 2, "keep");
    engine.startRound(room);
    const fixedId = room.round.pool[0].id;

    engine.handleAction(room, "p1", "spin", {});
    assert.equal(room.round.result.id, fixedId);
    engine.handleAction(room, "p1", "spin_again", {});
    engine.handleAction(room, "p1", "spin", {});
    assert.equal(room.round.result.id, fixedId);
    engine.handleAction(room, "p1", "spin_again", {});

    assert.equal(room.round.counts[fixedId], 2);
  } finally {
    Math.random = originalRandom;
  }
});

test("spin_again is rejected in 'eliminate' mode", () => {
  const room = withEntries(makeRoom(), 3, "eliminate");
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  const res = engine.handleAction(room, "p1", "spin_again", {});
  assert.equal(res.handled, false);
});

test("new_game is host-only and only allowed from phase 'result'", () => {
  const room = withEntries(makeRoom(), 2, "eliminate");
  engine.startRound(room);
  engine.handleAction(room, "p1", "spin", {});
  engine.handleAction(room, "p1", "confirm_eliminate", {}); // -> phase "result"
  assert.equal(room.phase, "result");

  const rejected = engine.handleAction(room, "p2", "new_game", {});
  assert.equal(rejected.handled, false);

  const res = engine.handleAction(room, "p1", "new_game", {});
  assert.equal(res.handled, true);
  assert.equal(room.phase, "lobby");
  assert.equal(room.round, null);
});

test("getPublicRoundView exposes the pool/result/counts and the config's entries/mode", () => {
  const room = withEntries(makeRoom(), 3, "keep");
  engine.startRound(room);
  const view = engine.getPublicRoundView(room) as any;
  assert.equal(view.mode, "keep");
  assert.equal(view.entries.length, 3);
  assert.equal(view.pool.length, 3);
  assert.equal(view.result, null);
  assert.deepEqual(view.counts, {});
  assert.ok(typeof view.spinMs === "number");
});

test("getPublicRoundView returns null before a round starts", () => {
  const room = makeRoom();
  assert.equal(engine.getPublicRoundView(room), null);
});

test("getPrivateView/getRevealMessage have nothing to send", () => {
  assert.equal(engine.getPrivateView(), null);
  assert.equal(engine.getRevealMessage(), null);
});
