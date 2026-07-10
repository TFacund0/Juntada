const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/impostor/engine");

function makeRoom(overrides = {}) {
  return {
    code: "TEST1",
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

test("startRound assigns a word, a category and the right number of impostors", () => {
  const room = makeRoom();
  const res = engine.startRound(room);

  assert.equal(res.success, true);
  assert.equal(room.phase, "round");
  assert.ok(room.round.word);
  assert.ok(room.round.categoryLabel);
  assert.equal(room.round.impostors.length, 1); // default numImpostors = 1
  assert.ok(room.round.impostors.every(id => room.players.some(p => p.id === id)));
  assert.ok(room.players.every(p => p.ready === false));
});

test("startRound caps impostors at half the player count", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), numImpostors: 3 } });
  engine.startRound(room);
  assert.equal(room.round.impostors.length, 1); // floor(3 players / 2) = 1
});

test("startRound never repeats a word already used in this room", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: { objetos: true } } });
  const seen = new Set();
  for (let i = 0; i < 30; i++) {
    engine.startRound(room);
    assert.ok(!seen.has(room.round.word), `word "${room.round.word}" was reused`);
    seen.add(room.round.word);
  }
});

test("startRound reports an error when no category is enabled", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: {} } });
  const res = engine.startRound(room);
  assert.ok(res.error);
  assert.equal(room.round, null);
});

test("maybeAdvance moves round -> voting once every online player is ready", () => {
  const room = makeRoom();
  engine.startRound(room);

  room.players[0].ready = true;
  room.players[1].ready = true;
  engine.maybeAdvance(room);
  assert.equal(room.phase, "round", "should still wait for the third player");

  room.players[2].ready = true;
  engine.maybeAdvance(room);
  assert.equal(room.phase, "voting");
});

test("maybeAdvance ignores offline players when checking readiness", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.players[2].online = false; // p3 disconnected, shouldn't block the round

  room.players[0].ready = true;
  room.players[1].ready = true;
  engine.maybeAdvance(room);

  assert.equal(room.phase, "voting");
});

test("voting tallies votes and eliminates the most-voted player", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.phase = "voting";
  const impostorId = room.round.impostors[0];

  const voters = room.players.map(p => p.id);
  for (const voterId of voters) {
    engine.handleAction(room, voterId, "vote", { suspectId: impostorId });
  }

  assert.equal(room.phase, "result");
  assert.equal(room.round.eliminated, impostorId);
  assert.equal(room.round.wasImpostor, true);
  assert.equal(room.roundHistory.length, 1);
  assert.equal(room.roundHistory[0].eliminated, impostorId);
});

test("handleAction rejects a vote for a player that doesn't exist in the room", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.phase = "voting";

  const handled = engine.handleAction(room, "p1", "vote", { suspectId: "not-a-real-player-id" });

  assert.equal(handled, false);
  assert.deepEqual(room.round.votes, {});
});

test("handleAction ignores votes while not in the voting phase", () => {
  const room = makeRoom();
  engine.startRound(room); // phase is "round", not "voting"
  const handled = engine.handleAction(room, "p1", "vote", { suspectId: "p2" });
  assert.equal(handled, false);
  assert.deepEqual(room.round.votes, {});
});

test("getPublicRoundView hides the word but reveals it after the round resolves", () => {
  const room = makeRoom();
  engine.startRound(room);

  const midRoundView = engine.getPublicRoundView(room);
  assert.equal(midRoundView.word, undefined);
  assert.equal(midRoundView.impostors, undefined);

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: room.round.impostors[0] });

  const resultView = engine.getPublicRoundView(room);
  assert.deepEqual(resultView.impostors, room.round.impostors);
});

test("getPrivateView never reveals the word to the impostor", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find(p => p.id !== impostorId).id;

  assert.equal(engine.getPrivateView(room, impostorId).word, null);
  assert.equal(engine.getPrivateView(room, innocentId).word, room.round.word);
});
