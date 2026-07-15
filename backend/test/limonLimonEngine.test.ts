const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/limon-limon/engine");

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
      { id: "p3", name: "Caro", ready: false, online: true },
    ],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
    ...overrides,
  };
}

test("createConfig builds a description for all 40 cards", () => {
  const config = engine.createConfig();
  assert.equal(Object.keys(config.descriptions).length, 40);
  assert.match(config.descriptions["oro-1"], /doble/); // oro override
  assert.doesNotMatch(config.descriptions["copa-1"], /doble/);
});

test("startRound refuses below the minimum player count", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound deals a full 40-card deck and sets the first turn", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "round");
  assert.equal(room.round.deck.length, 40);
  assert.equal(room.round.current, null);
  assert.equal(room.round.turnId, "p1");
});

test("reveal is turn-only and pops the top card into `current`", () => {
  const room = makeRoom();
  engine.startRound(room);

  const wrongTurn = engine.handleAction(room, "p2", "reveal", {});
  assert.equal(wrongTurn.handled, false);

  const res = engine.handleAction(room, "p1", "reveal", {});
  assert.equal(res.handled, true);
  assert.ok(room.round.current);
  assert.equal(room.round.deck.length, 39);
});

test("reveal is rejected while a card is already pending assignment", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "reveal", {});
  const res = engine.handleAction(room, "p1", "reveal", {});
  assert.equal(res.handled, false);
});

test("assign gives the current card to the target and advances the turn", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "reveal", {});
  const card = room.round.current;

  const res = engine.handleAction(room, "p1", "assign", { targetId: "p2" });
  assert.equal(res.handled, true);
  assert.deepEqual(room.round.piles.p2, [card]);
  assert.equal(room.round.current, null);
  assert.equal(room.round.turnId, "p2");
  assert.deepEqual(room.round.history, [{ ...card, eatenBy: "p2" }]);
});

test("assign rejects a target that isn't in the room", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "reveal", {});
  const res = engine.handleAction(room, "p1", "assign", { targetId: "ghost" });
  assert.equal(res.handled, false);
});

test("assign is turn-only", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "reveal", {});
  const res = engine.handleAction(room, "p2", "assign", { targetId: "p2" });
  assert.equal(res.handled, false);
});

test("emptying the deck via assign ends the round in result", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.round.deck = [{ suit: "oro", value: 1 }]; // force exactly one card left
  engine.handleAction(room, "p1", "reveal", {});
  engine.handleAction(room, "p1", "assign", { targetId: "p1" });
  assert.equal(room.phase, "result");
});

test("vote_end cuts the round once half of online players vote", () => {
  const room = makeRoom();
  engine.startRound(room);

  engine.handleAction(room, "p1", "vote_end", {});
  assert.equal(room.phase, "round", "1 of 3 shouldn't be enough");

  engine.handleAction(room, "p2", "vote_end", {});
  assert.equal(room.phase, "result");
});

test("vote_end ignores duplicate votes from the same player", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "vote_end", {});
  engine.handleAction(room, "p1", "vote_end", {});
  assert.equal(room.round.endVotes.length, 1);
});

test("getPublicRoundView exposes remaining count, pile counts and turn order", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "reveal", {});
  engine.handleAction(room, "p1", "assign", { targetId: "p2" });

  const view = engine.getPublicRoundView(room);
  assert.equal(view.remaining, 39);
  assert.equal(view.pileCounts.p2, 1);
  assert.deepEqual(view.order, ["p1", "p2", "p3"]);
});

test("getPublicRoundView returns null before the round starts", () => {
  const room = makeRoom();
  assert.equal(engine.getPublicRoundView(room), null);
});

test("maybeAdvance hands the turn to the next online player once the current turn holder goes offline", () => {
  const room = makeRoom();
  engine.startRound(room);
  assert.equal(room.round.turnId, "p1");

  room.players.find((p: TestPlayer) => p.id === "p1")!.online = false;
  engine.maybeAdvance(room);
  assert.equal(room.round.turnId, "p2", "p1 is offline, so it skips to p2");
});

test("maybeAdvance skips multiple consecutive offline players in one pass", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.players.find((p: TestPlayer) => p.id === "p1")!.online = false;
  room.players.find((p: TestPlayer) => p.id === "p2")!.online = false;

  engine.maybeAdvance(room);
  assert.equal(room.round.turnId, "p3");
});

test("maybeAdvance leaves the turn alone if everyone is offline (nothing to hand it to)", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.players.forEach((p: TestPlayer) => (p.online = false));

  engine.maybeAdvance(room);
  assert.equal(room.round.turnId, "p1");
});

test("maybeAdvance is a no-op once the round has ended", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.round.deck = [{ suit: "oro", value: 1 }];
  engine.handleAction(room, "p1", "reveal", {});
  engine.handleAction(room, "p1", "assign", { targetId: "p1" });
  assert.equal(room.phase, "result");

  room.players.find((p: TestPlayer) => p.id === "p2")!.online = false;
  assert.doesNotThrow(() => engine.maybeAdvance(room));
});
