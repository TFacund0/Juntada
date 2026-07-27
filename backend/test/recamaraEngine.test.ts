const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/recamara/engine");

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

test("startRound loads the chamber, enters the reveal sub-phase, and maps seats to room player ids", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "playing");
  assert.equal(room.round.subPhase, "reveal");
  assert.deepEqual(room.round.seatOrder, ["p1", "p2"]);
  assert.equal(room.round.state.players.length, 2);
  assert.equal(room.round.roundNumber, 1);
});

test("startRound refuses below the minimum or above the maximum player count", () => {
  const tooFew = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  assert.ok(engine.startRound(tooFew).error);

  const tooMany = makeRoom({
    players: [1, 2, 3, 4, 5].map(i => ({ id: `p${i}`, name: `J${i}`, ready: false, online: true })),
  });
  assert.ok(engine.startRound(tooMany).error);
});

test("fire is rejected outside the duel sub-phase (still revealing items)", () => {
  const room = makeRoom();
  engine.startRound(room);
  const res = engine.handleAction(room, "p1", "fire", { targetId: "p1" });
  assert.equal(res.handled, false);
});

test("ready_for_duel only flips subPhase once every seat has signaled ready", () => {
  const room = makeRoom();
  engine.startRound(room);

  const first = engine.handleAction(room, "p1", "ready_for_duel", {});
  assert.equal(first.handled, true);
  assert.equal(room.round.subPhase, "reveal");

  const second = engine.handleAction(room, "p2", "ready_for_duel", {});
  assert.equal(second.handled, true);
  assert.equal(room.round.subPhase, "duel");
  assert.deepEqual(room.round.readyForDuel, []);
});

function enterDuel(room: TestRoom) {
  engine.startRound(room);
  room.players.forEach((p: TestPlayer) => engine.handleAction(room, p.id, "ready_for_duel", {}));
}

test("fire is rejected from anyone other than the current turn's player", () => {
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const otherPlayerId = room.players.find((p: TestPlayer) => p.id !== currentPlayerId)!.id;

  const res = engine.handleAction(room, otherPlayerId, "fire", { targetId: currentPlayerId });
  assert.equal(res.handled, false);
});

test("fire resolves immediately, sets pendingFire with a seq, and applies damage on a live round", () => {
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const targetEngineId = room.round.state.shells.length ? (currentEngineId + 1) % room.round.state.order.length : currentEngineId;
  const targetPlayerId = room.round.seatOrder[room.round.state.order[targetEngineId]];

  // Force the current shell to a known live round so the test is deterministic.
  room.round.state.shells[room.round.state.idx] = { kind: "live", spent: false, revealed: false };
  const livesBefore = room.round.state.players.find((p: any) => p.id === room.round.state.order[targetEngineId]).lives;

  const res = engine.handleAction(room, currentPlayerId, "fire", { targetId: targetPlayerId });
  assert.equal(res.handled, true);
  assert.equal(room.round.pendingFire.seq, 1);
  assert.equal(room.round.pendingFire.shooterId, currentPlayerId);
  assert.equal(room.round.pendingFire.targetId, targetPlayerId);
  assert.equal(room.round.pendingFire.shellKind, "live");

  const livesAfter = room.round.state.players.find((p: any) => p.id === room.round.state.order[targetEngineId]).lives;
  assert.equal(livesAfter, livesBefore - 1);
});

test("a second fire from whoever's turn it now is succeeds — pendingFire never blocks a later shot", () => {
  // Regression test: pendingFire is set once fire() resolves and is never
  // reset to null anywhere in this engine — it's a broadcast marker clients
  // diff by `seq` for their own buffered animation, not an in-flight lock.
  // A guard of `|| r.pendingFire` on fire()/use_item's entry check used to
  // reject every action for the rest of the match after the very first shot,
  // since nothing ever cleared it back to null.
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];

  const first = engine.handleAction(room, currentPlayerId, "fire", { targetId: currentPlayerId });
  assert.equal(first.handled, true);
  assert.ok(room.round.pendingFire);
  const firstSeq = room.round.pendingFire.seq;

  const nextEngineId = room.round.state.order[room.round.state.turnPos];
  const nextPlayerId = room.round.seatOrder[nextEngineId];
  const second = engine.handleAction(room, nextPlayerId, "fire", { targetId: nextPlayerId });
  assert.equal(second.handled, true);
  assert.equal(room.round.pendingFire.seq, firstSeq + 1);
});

test("a shot ending the duel sets room.phase to 'result' and records the winner's room id", () => {
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const targetEngineId = room.round.state.order.find((id: number) => id !== currentEngineId);
  const targetPlayerId = room.round.seatOrder[targetEngineId];

  room.round.state.players.find((p: any) => p.id === targetEngineId).lives = 1;
  room.round.state.shells[room.round.state.idx] = { kind: "live", spent: false, revealed: false };

  engine.handleAction(room, currentPlayerId, "fire", { targetId: targetPlayerId });

  assert.equal(room.phase, "result");
  assert.equal(room.round.pendingFire.gameOver, true);
  assert.equal(room.round.winnerRoomId, currentPlayerId);
});

test("emptying the chamber sends the round back to 'reveal' and bumps roundNumber", () => {
  const room = makeRoom();
  enterDuel(room);
  room.round.state.shells = [{ kind: "blank", spent: false, revealed: false }];
  room.round.state.idx = 0;
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const targetEngineId = room.round.state.order.find((id: number) => id !== currentEngineId);
  const targetPlayerId = room.round.seatOrder[targetEngineId];

  engine.handleAction(room, currentPlayerId, "fire", { targetId: targetPlayerId });

  assert.equal(room.round.subPhase, "reveal");
  assert.equal(room.round.roundNumber, 2);
  assert.deepEqual(room.round.readyForDuel, []);
});

test("use_item is rejected from anyone other than the current turn's player", () => {
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const otherPlayerId = room.players.find((p: TestPlayer) => p.id !== currentPlayerId)!.id;
  room.round.state.players.find((p: any) => p.id !== currentEngineId).items = ["🚬"];

  const res = engine.handleAction(room, otherPlayerId, "use_item", { item: "🚬" });
  assert.equal(res.handled, false);
});

test("use_item (cigarrillo) heals the current player and consumes the item", () => {
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const me = room.round.state.players.find((p: any) => p.id === currentEngineId);
  me.items = ["🚬"];
  me.lives = 2;

  const res = engine.handleAction(room, currentPlayerId, "use_item", { item: "🚬" });
  assert.equal(res.handled, true);
  assert.equal(room.round.lastItemEvent.seq, 1);
  assert.equal(room.round.lastItemEvent.item, "🚬");
  assert.equal(room.round.lastItemEvent.healedTo, 3);
  assert.deepEqual(room.round.state.players.find((p: any) => p.id === currentEngineId).items, []);
});

test("use_item (ladrón) with an explicit target/item maps room ids to engine ids correctly", () => {
  const room = makeRoom();
  enterDuel(room);
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const victimEngineId = room.round.state.order.find((id: number) => id !== currentEngineId);
  const victimPlayerId = room.round.seatOrder[victimEngineId];

  room.round.state.players.find((p: any) => p.id === currentEngineId).items = ["🧤"];
  room.round.state.players.find((p: any) => p.id === victimEngineId).items = ["📞"];

  const res = engine.handleAction(room, currentPlayerId, "use_item", { item: "🧤", targetId: victimPlayerId, stolenItem: "📞" });
  assert.equal(res.handled, true);
  assert.equal(room.round.lastItemEvent.victimId, victimPlayerId);
  assert.equal(room.round.lastItemEvent.stolenItem, "📞");
  assert.deepEqual(room.round.state.players.find((p: any) => p.id === victimEngineId).items, []);
  assert.deepEqual(room.round.state.players.find((p: any) => p.id === currentEngineId).items, ["📞"]);
});

test("a reload never lets a player's item count exceed the shared engine's MAX_ITEMS cap", () => {
  const room = makeRoom();
  enterDuel(room);
  room.round.state.players[0].items = ["🔍", "🚬", "🪚", "🔄"]; // 4 already
  room.round.state.shells = [{ kind: "blank", spent: false, revealed: false }];
  room.round.state.idx = 0;
  const currentEngineId = room.round.state.order[room.round.state.turnPos];
  const currentPlayerId = room.round.seatOrder[currentEngineId];
  const targetEngineId = room.round.state.order.find((id: number) => id !== currentEngineId);
  const targetPlayerId = room.round.seatOrder[targetEngineId];

  const res = engine.handleAction(room, currentPlayerId, "fire", { targetId: targetPlayerId });
  assert.equal(res.handled, true);
  assert.equal(room.round.state.players[0].items.length, 5);
});

test("getPublicRoundView strips the kind of any shell that hasn't been revealed yet", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.round.state.shells = [
    { kind: "live", spent: false, revealed: false },
    { kind: "blank", spent: true, revealed: true },
  ];

  const view = engine.getPublicRoundView(room) as { state: { shells: any[] }; liveCount: number; blankCount: number };
  assert.equal(view.state.shells[0].kind, null);
  assert.equal(view.state.shells[1].kind, "blank");
  // The aggregate split stays public even though individual unrevealed
  // shells don't — same as local mode's reveal screen.
  assert.equal(view.liveCount, 1);
  assert.equal(view.blankCount, 1);
});

test("getPrivateView has nothing to send — items are public knowledge same as local mode", () => {
  const room = makeRoom();
  engine.startRound(room);
  assert.equal(engine.getPrivateView(room, "p1"), null);
});
