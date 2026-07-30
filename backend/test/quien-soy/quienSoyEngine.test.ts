const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../src/games/quien-soy/engine");

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

// Categories mode now passes through the same brief "assign" beat as
// suggested mode before "playing" (see engine.ts's startRound) — tests that
// only care about the "playing" phase itself use this to skip past it.
function startCategoriesRound(room: TestRoom) {
  const res = engine.startRound(room);
  engine.handleAction(room, room.hostId, "confirm_words_ready");
  return res;
}

test("startRound refuses below the minimum player count", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound succeeds with exactly 2 players and a full match resolves cleanly", () => {
  const room = makeRoom({
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
  });
  const res = startCategoriesRound(room);
  assert.equal(res.success, true);
  assert.equal(room.round.turnQueue.length, 2);

  while (room.round.turnQueue.length > 0) {
    engine.handleAction(room, room.round.turnQueue[0], "concede");
  }
  assert.equal(room.phase, "result");
  assert.equal(room.round.results.length, 2);
});

test("categories mode deals a distinct word to each player, then waits in 'assign' for the host before playing", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "assign");
  assert.equal(Object.keys(room.round.words).length, 3);
  const words = Object.values(room.round.words);
  assert.equal(new Set(words).size, 3, "words should be distinct across players");

  const byGuest = engine.handleAction(room, "p2", "confirm_words_ready");
  assert.equal(byGuest.handled, false, "not the host");
  assert.equal(room.phase, "assign");

  const byHost = engine.handleAction(room, room.hostId, "confirm_words_ready");
  assert.equal(byHost.handled, true);
  assert.equal(room.phase, "playing");
  assert.equal(room.round.turnQueue.length, 3);
});

test("categories mode refuses when no categories are active", () => {
  const room = makeRoom({
    config: {
      ...engine.createConfig(),
      activeCategories: Object.fromEntries(Object.keys(engine.createConfig().activeCategories).map(k => [k, false])),
    },
  });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("private view never reveals a player's own word, but reveals everyone else's", () => {
  const room = makeRoom();
  engine.startRound(room);
  const view = engine.getPrivateView(room, "p1");
  assert.equal(view.wordsVisibleToMe.p1, undefined);
  assert.equal(view.wordsVisibleToMe.p2, room.round.words.p2);
  assert.equal(view.wordsVisibleToMe.p3, room.round.words.p3);
});

// Everyone writes one word for every OTHER player, submitted together as a
// single batch keyed by target id — see engine.ts's submitSuggestion.
function suggestForEveryoneElse(room: TestRoom, playerId: string) {
  const suggestions = Object.fromEntries(
    room.players.filter((p: TestPlayer) => p.id !== playerId).map((p: TestPlayer) => [p.id, `${playerId} for ${p.id}`]),
  );
  return engine.handleAction(room, playerId, "submit_suggestion", { suggestions });
}

test("suggested mode: writing a word for a given player is optional — blanks/omissions are just skipped, and a submitter can't resubmit", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);

  // Only wrote something for p2, left p3 out entirely.
  const first = engine.handleAction(room, "p1", "submit_suggestion", { suggestions: { p2: "algo", p3: "   " } });
  assert.equal(first.handled, true);
  assert.deepEqual(
    room.round.suggestions.p2.map((s: { text: string }) => s.text),
    ["algo"],
  );
  assert.equal(room.round.suggestions.p3.length, 0, "blank entry wasn't recorded");

  const second = engine.handleAction(room, "p1", "submit_suggestion", { suggestions: { p3: "otra cosa" } });
  assert.equal(second.handled, false, "already submitted");
});

test("suggested mode: a target nobody wrote anything for still gets a word, from the fallback pool", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);

  // Nobody ever suggests anything for p3.
  engine.handleAction(room, "p1", "submit_suggestion", { suggestions: { p2: "algo de p1" } });
  engine.handleAction(room, "p2", "submit_suggestion", { suggestions: { p1: "algo de p2" } });
  engine.handleAction(room, "p3", "submit_suggestion", { suggestions: {} });

  assert.ok(room.round.words.p3, "p3 still ended up with a word despite nobody suggesting one");
  assert.equal(room.round.suggestions.p3.length, 0);
});

test("suggested mode: a submission for yourself is ignored even if included", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);
  engine.handleAction(room, "p1", "submit_suggestion", { suggestions: { p1: "self", p2: "for p2", p3: "for p3" } });
  assert.ok(!room.round.suggestions.p1.some((s: { by: string }) => s.by === "p1"));
});

test("suggested mode: with 3 players everyone suggests for everyone else, so every target needs a vote", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);

  suggestForEveryoneElse(room, "p1");
  assert.equal(room.phase, "suggest", "still waiting on p2 and p3");
  suggestForEveryoneElse(room, "p2");
  suggestForEveryoneElse(room, "p3");

  assert.equal(room.phase, "vote");
  assert.equal(room.round.suggestions[room.round.currentVoteTarget].length, 2);
});

test("suggested mode: a 2-player room never has anything to vote on — words are assigned straight from the single suggestion", () => {
  const room = makeRoom({
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
    config: { ...engine.createConfig(), wordSource: "suggested" },
  });
  engine.startRound(room);
  suggestForEveryoneElse(room, "p1");
  suggestForEveryoneElse(room, "p2");

  assert.equal(room.phase, "assign", "nothing needed a vote, but there's still the brief 'words are ready' phase");
  assert.equal(room.round.words.p1, "p2 for p1");
  assert.equal(room.round.words.p2, "p1 for p2");
});

test("suggested mode: the vote target can't vote on their own word", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);
  ["p1", "p2", "p3"].forEach(id => suggestForEveryoneElse(room, id));

  const target = room.round.currentVoteTarget;
  const res = engine.handleAction(room, target, "vote_suggestion", { suggestionIndex: 0 });
  assert.equal(res.handled, false);
});

test("suggested mode: once every eligible voter votes, the target's word locks in and voting moves to the next target", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);
  ["p1", "p2", "p3"].forEach(id => suggestForEveryoneElse(room, id));

  const firstTarget = room.round.currentVoteTarget;
  const voters = room.players.map((p: TestPlayer) => p.id).filter((id: string) => id !== firstTarget);
  voters.forEach((id: string) => engine.handleAction(room, id, "vote_suggestion", { suggestionIndex: 0 }));

  assert.ok(room.round.words[firstTarget]);
  assert.notEqual(room.round.currentVoteTarget, firstTarget);
});

test("suggested mode: after every target has been voted on, it's 'assign' (not straight to playing)", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);
  ["p1", "p2", "p3"].forEach(id => suggestForEveryoneElse(room, id));

  for (let i = 0; i < 3; i++) {
    const target = room.round.currentVoteTarget;
    const voters = room.players.map((p: TestPlayer) => p.id).filter((id: string) => id !== target);
    voters.forEach((id: string) => engine.handleAction(room, id, "vote_suggestion", { suggestionIndex: 0 }));
  }

  assert.equal(room.phase, "assign");
  assert.equal(Object.keys(room.round.words).length, 3);
});

test("suggested mode: confirm_words_ready is host-only, only works in 'assign', and moves the room into 'playing'", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), wordSource: "suggested" } });
  engine.startRound(room);
  ["p1", "p2", "p3"].forEach(id => suggestForEveryoneElse(room, id));
  for (let i = 0; i < 3; i++) {
    const target = room.round.currentVoteTarget;
    const voters = room.players.map((p: TestPlayer) => p.id).filter((id: string) => id !== target);
    voters.forEach((id: string) => engine.handleAction(room, id, "vote_suggestion", { suggestionIndex: 0 }));
  }
  assert.equal(room.phase, "assign");

  const byGuest = engine.handleAction(room, "p2", "confirm_words_ready");
  assert.equal(byGuest.handled, false, "not the host");
  assert.equal(room.phase, "assign");

  const byHost = engine.handleAction(room, room.hostId, "confirm_words_ready");
  assert.equal(byHost.handled, true);
  assert.equal(room.phase, "playing");
});

test("asking a question is turn-holder-only, and the turn only advances once everyone else has answered or passed", () => {
  const room = makeRoom();
  startCategoriesRound(room);
  const turnPlayer = room.round.turnQueue[0];
  const others = room.players.map((p: TestPlayer) => p.id).filter((id: string) => id !== turnPlayer);

  const wrongAsker = engine.handleAction(room, others[0], "ask_question", { text: "¿Sos famoso?" });
  assert.equal(wrongAsker.handled, false);

  engine.handleAction(room, turnPlayer, "ask_question", { text: "¿Sos famoso?" });
  assert.ok(room.round.pendingQuestion);

  const selfAnswer = engine.handleAction(room, turnPlayer, "answer_question", { answer: "si" });
  assert.equal(selfAnswer.handled, false, "the asker can't answer their own question");

  const firstAnswer = engine.handleAction(room, others[0], "answer_question", { answer: "si", comment: "más o menos" });
  assert.equal(firstAnswer.handled, true);
  assert.ok(room.round.pendingQuestion, "still waiting on the rest before the turn advances");
  assert.equal(room.round.qaLog.length, 0);

  const repeatAnswer = engine.handleAction(room, others[0], "answer_question", { answer: "no" });
  assert.equal(repeatAnswer.handled, false, "can't answer the same question twice");

  const res = engine.handleAction(room, others[1], "answer_question", { answer: "skip" });
  assert.equal(res.handled, true);
  assert.equal(room.round.qaLog.length, 1);
  assert.equal(room.round.qaLog[0].responses[others[0]].answer, "si");
  assert.equal(room.round.qaLog[0].responses[others[0]].comment, "más o menos");
  assert.equal(room.round.qaLog[0].responses[others[1]].answer, "skip");
  assert.equal(room.round.pendingQuestion, null);
  assert.notEqual(room.round.turnQueue[0], turnPlayer, "turn moved on");
});

test("a correct guess solves the round for that player and removes them from the queue", () => {
  const room = makeRoom();
  startCategoriesRound(room);
  const turnPlayer = room.round.turnQueue[0];
  const myWord = room.round.words[turnPlayer];

  const res = engine.handleAction(room, turnPlayer, "guess", { text: myWord });
  assert.equal(res.handled, true);
  assert.ok(!room.round.turnQueue.includes(turnPlayer));
  assert.equal(room.round.results[0].outcome, "solved");
});

test("guessing is accent/case-insensitive", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), activeCategories: { "personajes-famosos": true } } });
  startCategoriesRound(room);
  const turnPlayer = room.round.turnQueue[0];
  const myWord = room.round.words[turnPlayer]; // e.g. "Lionel Messi"

  const res = engine.handleAction(room, turnPlayer, "guess", { text: myWord.toUpperCase() });
  assert.equal(room.round.results[0]?.outcome, "solved");
  assert.equal(res.handled, true);
});

test("guessing just one significant word of a multi-word word still solves it", () => {
  const room = makeRoom({
    config: { ...engine.createConfig(), wordSource: "suggested" },
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
  });
  engine.startRound(room);
  // 2-player suggested mode assigns straight from the single suggestion —
  // no vote needed (see suggestForEveryoneElse's own test for that rule).
  engine.handleAction(room, "p1", "submit_suggestion", { suggestions: { p2: "Lionel Messi" } });
  engine.handleAction(room, "p2", "submit_suggestion", { suggestions: { p1: "Cualquier Cosa" } });
  engine.handleAction(room, room.hostId, "confirm_words_ready");

  const turnPlayer = room.round.turnQueue.find((id: string) => room.round.words[id] === "Lionel Messi");
  // Force it to be that player's turn regardless of shuffle order.
  while (room.round.turnQueue[0] !== turnPlayer) engine.handleAction(room, room.round.turnQueue[0], "concede");

  const res = engine.handleAction(room, turnPlayer, "guess", { text: "messi" });
  assert.equal(res.handled, true);
  assert.equal(room.round.guessLog[room.round.guessLog.length - 1].correct, true);
  assert.equal(room.round.results.find((r: any) => r.playerId === turnPlayer)?.outcome, "solved");
});

test("guessing a short filler word of a multi-word word doesn't solve it", () => {
  const room = makeRoom({
    config: { ...engine.createConfig(), wordSource: "suggested" },
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
  });
  engine.startRound(room);
  engine.handleAction(room, "p1", "submit_suggestion", { suggestions: { p2: "Rey de Corazones" } });
  engine.handleAction(room, "p2", "submit_suggestion", { suggestions: { p1: "Cualquier Cosa" } });
  engine.handleAction(room, room.hostId, "confirm_words_ready");

  const turnPlayer = room.round.turnQueue.find((id: string) => room.round.words[id] === "Rey de Corazones");
  while (room.round.turnQueue[0] !== turnPlayer) engine.handleAction(room, room.round.turnQueue[0], "concede");

  const res = engine.handleAction(room, turnPlayer, "guess", { text: "de" });
  assert.equal(res.handled, true);
  assert.equal(room.round.guessLog[room.round.guessLog.length - 1].correct, false);
});

test("three wrong guesses eliminate a player with zero points", () => {
  const room = makeRoom();
  startCategoriesRound(room);

  for (let i = 0; i < 3; i++) {
    const turnPlayer = room.round.turnQueue[0];
    engine.handleAction(room, turnPlayer, "guess", { text: "definitely wrong answer" });
    // Rotate other players' turns out of the way by having them concede-free
    // no-ops isn't needed — submit_guess itself advances the turn.
    if (room.round.wrongGuesses[turnPlayer] >= 3) break;
    // Cycle back around to the same player two more times.
    while (room.round.turnQueue[0] !== turnPlayer && room.round.turnQueue.length > 0) {
      const p = room.round.turnQueue[0];
      if (p === turnPlayer) break;
      engine.handleAction(room, p, "guess", { text: "also wrong" });
    }
  }

  const eliminated = room.round.results.find((r: any) => r.outcome === "eliminated");
  assert.ok(eliminated, "someone should have been eliminated after 3 wrong guesses");
});

test("conceding on your turn removes you from the queue with no points", () => {
  const room = makeRoom();
  startCategoriesRound(room);
  const turnPlayer = room.round.turnQueue[0];

  const res = engine.handleAction(room, turnPlayer, "concede");
  assert.equal(res.handled, true);
  assert.ok(!room.round.turnQueue.includes(turnPlayer));
  assert.equal(room.round.results[0].outcome, "conceded");
});

test("the game ends and scores when the queue empties, tying same-lap solvers at the same rank", () => {
  const room = makeRoom();
  startCategoriesRound(room);

  // Everyone solves on their very first turn -> same lap -> tied for 1st.
  while (room.round.turnQueue.length > 0) {
    const turnPlayer = room.round.turnQueue[0];
    const myWord = room.round.words[turnPlayer];
    engine.handleAction(room, turnPlayer, "guess", { text: myWord });
  }

  assert.equal(room.phase, "result");
  const scores = Object.values(room.config.score) as number[];
  assert.equal(new Set(scores).size, 1, "everyone solved in lap 1, so everyone scores the same");
  assert.ok(
    scores.every(s => s === 3),
    "tied for 1st out of 3 players scores playerCount points each",
  );
});

test("new_game is host-only and resets the score", () => {
  const room = makeRoom();
  startCategoriesRound(room);
  while (room.round.turnQueue.length > 0) {
    const turnPlayer = room.round.turnQueue[0];
    engine.handleAction(room, turnPlayer, "concede");
  }
  assert.ok(Object.keys(room.config.score).length === 0, "everyone conceded, nobody scores");

  const wrongPlayer = engine.handleAction(room, "p2", "new_game", {});
  assert.equal(wrongPlayer.handled, false);

  const res = engine.handleAction(room, "p1", "new_game", {});
  assert.equal(res.handled, true);
  assert.deepEqual(room.config.score, {});
  assert.equal(room.phase, "lobby");
  assert.equal(room.round, null);
});

test("getPublicRoundView hides words until the result phase", () => {
  const room = makeRoom();
  startCategoriesRound(room);
  assert.equal(engine.getPublicRoundView(room).words, null);

  while (room.round.turnQueue.length > 0) {
    const turnPlayer = room.round.turnQueue[0];
    engine.handleAction(room, turnPlayer, "concede");
  }
  assert.deepEqual(engine.getPublicRoundView(room).words, room.round.words);
});
