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

function readyAll(room) {
  room.players.forEach(p => { p.ready = true; });
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

test("startRound refuses to start below the minimum player count", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }, { id: "p2", name: "Beto", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
  assert.equal(room.round, null);
});

test("startRound caps impostors at half the player count", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), numImpostors: 3 } });
  engine.startRound(room);
  assert.equal(room.round.impostors.length, 1); // floor(3 players / 2) = 1
});

test("startRound falls back to a sane default when numImpostors is malformed", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), numImpostors: "not-a-number" }, players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })) });
  engine.startRound(room);
  assert.equal(room.round.impostors.length, 1);
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

test("startRound doesn't crash when enabledCategories is malformed", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: null } });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("maybeAdvance moves round -> discussion once every online player is ready", () => {
  const room = makeRoom();
  engine.startRound(room);

  room.players[0].ready = true;
  room.players[1].ready = true;
  engine.maybeAdvance(room);
  assert.equal(room.phase, "round", "should still wait for the third player");

  room.players[2].ready = true;
  engine.maybeAdvance(room);
  assert.equal(room.phase, "discussion");
  assert.ok(room.round.discussionEnd, "a discussion timer should be scheduled");
  assert.ok(room.players.every(p => p.ready === false), "readiness resets for the discussion phase's own consensus");
});

test("maybeAdvance moves discussion -> voting once every online player is ready again", () => {
  const room = makeRoom();
  engine.startRound(room);
  readyAll(room);
  engine.maybeAdvance(room); // -> discussion

  readyAll(room);
  engine.maybeAdvance(room);
  assert.equal(room.phase, "voting");
  assert.equal(room.round.discussionEnd, null);
});

test("discussionTime = 0 skips the discussion phase entirely", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), discussionTime: 0 } });
  engine.startRound(room);
  readyAll(room);
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

  assert.equal(room.phase, "discussion");
});

test("writtenClues requires a non-empty clue before player_ready is accepted", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), writtenClues: true } });
  engine.startRound(room);

  const withoutClue = engine.handleAction(room, "p1", "player_ready", {});
  assert.equal(withoutClue.handled, false);

  engine.handleAction(room, "p1", "submit_clue", { clue: "algo relacionado" });
  const withClue = engine.handleAction(room, "p1", "player_ready", {});
  assert.equal(withClue.handled, true);
});

test("submit_clue is stored and exposed on the public round view for review during voting", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), writtenClues: true } });
  engine.startRound(room);
  engine.handleAction(room, "p1", "submit_clue", { clue: "  playa  " });
  assert.equal(room.round.clues.p1, "playa");
  assert.equal(engine.getPublicRoundView(room).clues.p1, "playa");
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

  const res = engine.handleAction(room, "p1", "vote", { suspectId: "not-a-real-player-id" });

  assert.equal(res.handled, false);
  assert.deepEqual(room.round.votes, {});
});

test("handleAction ignores votes while not in the voting phase", () => {
  const room = makeRoom();
  engine.startRound(room); // phase is "round", not "voting"
  const res = engine.handleAction(room, "p1", "vote", { suspectId: "p2" });
  assert.equal(res.handled, false);
  assert.deepEqual(room.round.votes, {});
});

test("skip_word keeps the round going until a majority of online players ask for a new word", () => {
  const room = makeRoom();
  engine.startRound(room);
  const originalWord = room.round.word;

  const first = engine.handleAction(room, "p1", "skip_word", {});
  assert.equal(first.handled, true);
  assert.equal(first.rerolled, undefined, "1 of 3 shouldn't be a majority yet");
  assert.equal(room.round.word, originalWord);

  const second = engine.handleAction(room, "p2", "skip_word", {});
  assert.equal(second.rerolled, true, "2 of 3 online players is a majority");
  assert.notEqual(room.round.word, originalWord);
  assert.equal(room.round.skipVotes.length, 0, "skip votes reset after a reroll");
  assert.ok(room.players.every(p => p.ready === false), "readiness resets so everyone re-confirms the new word");
});

test("skip_word keeps the same impostors after a reroll", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorsBefore = [...room.round.impostors].sort();

  engine.handleAction(room, "p1", "skip_word", {});
  engine.handleAction(room, "p2", "skip_word", {});

  assert.deepEqual([...room.round.impostors].sort(), impostorsBefore);
});

test("skip_word ignores duplicate votes from the same player", () => {
  const room = makeRoom();
  engine.startRound(room);

  engine.handleAction(room, "p1", "skip_word", {});
  engine.handleAction(room, "p1", "skip_word", {});

  assert.equal(room.round.skipVotes.length, 1);
});

test("skip_word only counts online players toward the threshold", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.players[2].online = false; // only p1/p2 online -> majority of 2 is 2

  const res = engine.handleAction(room, "p1", "skip_word", {});
  assert.equal(res.rerolled, undefined);

  const res2 = engine.handleAction(room, "p2", "skip_word", {});
  assert.equal(res2.rerolled, true);
});

test("getPhaseTimerEnd tracks the clue timer during round and the discussion timer during discussion", () => {
  const room = makeRoom();
  engine.startRound(room);
  assert.equal(engine.getPhaseTimerEnd(room), room.round.timerEnd);

  readyAll(room);
  engine.maybeAdvance(room); // -> discussion
  assert.equal(engine.getPhaseTimerEnd(room), room.round.discussionEnd);
});

test("forceReadyAndAdvance acts as if every online player pressed ready", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.players[2].online = false;

  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "discussion");
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
