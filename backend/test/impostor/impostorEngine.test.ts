const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../src/games/impostor/engine");
const { CATEGORIES } = require("@juntada/impostor-data") as { CATEGORIES: Record<string, unknown> };

// The engine now defaults every category to disabled (the host has to
// actively pick some, see ConfigPanel.tsx) — these tests care about round
// flow, not category selection, so the shared default room has them all on.
function allCategoriesEnabled(): Record<string, boolean> {
  return Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {} as Record<string, boolean>);
}

// Loose on purpose: these tests poke at the engine's internal round shape
// directly (room.round.word, .impostors, etc.), which is exactly what `any`
// is for — the engine itself (engine.ts) is what's strictly typed.
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
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled() },
    round: null,
    usedWords: {},
    roundHistory: [],
    ...overrides,
  };
}

function readyAll(room: TestRoom): void {
  room.players.forEach(p => {
    p.ready = true;
  });
}

// Drives the round phase's turn order to completion by submitting a clue (or
// an empty confirmation, in spoken mode) for whoever's turn it currently is,
// repeating until the round moves on to discussion/voting.
function finishAllTurns(room: TestRoom, clueText = "algo"): void {
  while (room.phase === "round") {
    const currentId = room.round.turnOrder[room.round.turnIndex];
    const clue = room.config.writtenClues ? clueText : "";
    const res = engine.handleAction(room, currentId, "submit_clue", { clue });
    if (!res.handled) throw new Error(`submit_clue not handled for ${currentId} (phase=${room.phase})`);
  }
}

test("startRound assigns a word, a category and the right number of impostors", () => {
  const room = makeRoom();
  const res = engine.startRound(room);

  assert.equal(res.success, true);
  assert.equal(room.phase, "round");
  assert.ok(room.round.word);
  assert.ok(room.round.categoryLabel);
  assert.equal(room.round.impostors.length, 1); // default numImpostors = 1
  assert.ok(room.round.impostors.every((id: string) => room.players.some(p => p.id === id)));
  assert.ok(room.players.every(p => p.ready === false));
});

test("startRound refuses to start below the minimum player count", () => {
  const room = makeRoom({
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
  });
  const res = engine.startRound(room);
  assert.ok(res.error);
  assert.equal(room.round, null);
});

test("startRound caps impostors so they stay a strict minority", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), numImpostors: 3 } });
  engine.startRound(room);
  assert.equal(room.round.impostors.length, 1); // 3 players: impostors must stay < innocents, so max 1

  const fourPlayerRoom = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), numImpostors: 2 },
  });
  engine.startRound(fourPlayerRoom);
  assert.equal(
    fourPlayerRoom.round.impostors.length,
    1,
    "4 players with 2 impostors would start the match already at parity — capped down to 1",
  );
});

test("startRound falls back to a sane default when numImpostors is malformed", () => {
  const room = makeRoom({
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), numImpostors: "not-a-number" },
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  });
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

test("startRound computes a turn order covering every player, turn 0", () => {
  const room = makeRoom();
  engine.startRound(room);
  assert.equal(room.round.turnIndex, 0);
  assert.deepEqual([...room.round.turnOrder].sort(), ["p1", "p2", "p3"]);
});

test("submit_clue only works for whoever's turn it currently is", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), writtenClues: true } });
  engine.startRound(room);
  const [first, second] = room.round.turnOrder;

  const wrongPlayer = engine.handleAction(room, second, "submit_clue", { clue: "algo" });
  assert.equal(wrongPlayer.handled, false);
  assert.equal(room.round.turnIndex, 0);

  const res = engine.handleAction(room, first, "submit_clue", { clue: "algo" });
  assert.equal(res.handled, true);
  assert.equal(room.round.turnIndex, 1, "the turn passes to the next player");
});

test("writtenClues requires a non-empty clue for the turn to advance", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), writtenClues: true } });
  engine.startRound(room);
  const current = room.round.turnOrder[0];

  const empty = engine.handleAction(room, current, "submit_clue", { clue: "   " });
  assert.equal(empty.handled, false);
  assert.equal(room.round.turnIndex, 0);

  const res = engine.handleAction(room, current, "submit_clue", { clue: "algo relacionado" });
  assert.equal(res.handled, true);
  assert.equal(room.round.turnIndex, 1);
});

test("spoken mode (writtenClues off) advances the turn on an empty confirmation", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), writtenClues: false } });
  engine.startRound(room);
  const current = room.round.turnOrder[0];

  const res = engine.handleAction(room, current, "submit_clue", { clue: "" });
  assert.equal(res.handled, true);
  assert.equal(room.round.turnIndex, 1);
  assert.equal(room.round.clues[current], "");
});

test("finishing every turn moves round -> discussion", () => {
  const room = makeRoom();
  engine.startRound(room);
  finishAllTurns(room);
  assert.equal(room.phase, "discussion");
  assert.ok(room.round.discussionEnd, "a discussion timer should be scheduled");
});

test("maybeAdvance moves discussion -> voting once every online player is ready again", () => {
  const room = makeRoom();
  engine.startRound(room);
  finishAllTurns(room); // -> discussion

  readyAll(room);
  engine.maybeAdvance(room);
  assert.equal(room.phase, "voting");
  assert.equal(room.round.discussionEnd, null);
});

test("discussionTime = 0 skips the discussion phase entirely", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), discussionTime: 0 } });
  engine.startRound(room);
  finishAllTurns(room);
  assert.equal(room.phase, "voting");
});

test("an offline player's turn is skipped automatically", () => {
  const room = makeRoom();
  engine.startRound(room);
  const offlineId = room.round.turnOrder[1];
  room.players.find((p: TestPlayer) => p.id === offlineId)!.online = false;

  engine.handleAction(room, room.round.turnOrder[0], "submit_clue", { clue: "pista" });
  assert.equal(room.round.turnIndex, 2, "turn 1 (offline) was skipped");
});

test("a disconnected impostor merely going offline does NOT abort the match — they get a grace period to reconnect", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  room.players.find((p: TestPlayer) => p.id === impostorId)!.online = false;

  engine.maybeAdvance(room); // what markOffline calls right after flipping online=false

  assert.equal(room.round.matchOver, false);
  assert.equal(room.round.abortedReason, undefined);
});

test("the match aborts once the offline impostor is actually removed (grace period expired)", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  room.players.find((p: TestPlayer) => p.id === impostorId)!.online = false;
  engine.maybeAdvance(room); // still within the grace period, no-op

  // Mirrors what roomHandlers.ts's schedulePlayerKick does once the 5-minute
  // grace period elapses: remove them from room.players, then re-check.
  room.players = room.players.filter((p: TestPlayer) => p.id !== impostorId);
  engine.maybeAdvance(room);

  assert.equal(room.phase, "result");
  assert.equal(room.round.matchOver, true);
  assert.equal(room.round.winner, null);
  assert.equal(room.round.abortedReason, "impostor_disconnected");
  assert.equal(room.roundHistory.at(-1).abortedReason, "impostor_disconnected");
});

test("the match keeps going if a non-impostor disconnects mid-round", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const bystanderId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;
  room.players.find((p: TestPlayer) => p.id === bystanderId)!.online = false;

  engine.maybeAdvance(room);

  assert.equal(room.round.matchOver, false);
  assert.equal(room.round.abortedReason, undefined);
});

test("a reconnected impostor (online again within the grace period) never triggers the abort", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const p = room.players.find((p: TestPlayer) => p.id === impostorId)!;
  p.online = false;
  engine.maybeAdvance(room);
  p.online = true; // rejoin, same as roomService.rejoinRoom flipping it back
  engine.maybeAdvance(room);

  assert.equal(room.round.matchOver, false);
  assert.equal(room.round.abortedReason, undefined);
});

test("an already-eliminated impostor going offline doesn't abort the match", () => {
  const room = makeRoom({
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
      { id: "p3", name: "Caro", ready: false, online: true },
      { id: "p4", name: "Dana", ready: false, online: true },
    ],
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), numImpostors: 1 },
  });
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  // Force-eliminate the impostor via a normal vote so the match keeps going
  // (an innocent-majority match doesn't end on the first catch by itself
  // here since there's only ever been one impostor to begin with — catching
  // them alone always ends it). Simulate that directly on the round instead.
  room.round.matchEliminated = [impostorId];
  room.players.find((p: TestPlayer) => p.id === impostorId)!.online = false;

  engine.maybeAdvance(room);

  assert.notEqual(room.round.abortedReason, "impostor_disconnected");
});

test("player_ready only works during the discussion phase", () => {
  const room = makeRoom();
  engine.startRound(room);
  const duringRound = engine.handleAction(room, "p1", "player_ready", {});
  assert.equal(duringRound.handled, false);

  finishAllTurns(room); // -> discussion
  const duringDiscussion = engine.handleAction(room, "p1", "player_ready", {});
  assert.equal(duringDiscussion.handled, true);
});

test("submit_clue is stored and exposed on the public round view for review during voting", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), writtenClues: true } });
  engine.startRound(room);
  engine.handleAction(room, room.round.turnOrder[0], "submit_clue", { clue: "  playa  " });
  assert.equal(room.round.clues[room.round.turnOrder[0]], "playa");
  assert.equal(engine.getPublicRoundView(room).clues[room.round.turnOrder[0]], "playa");
});

test("voting tallies votes, eliminates the most-voted player, and ends the match once every impostor is caught", () => {
  const room = makeRoom(); // 3 players, 1 impostor by default
  engine.startRound(room);
  room.phase = "voting";
  const impostorId = room.round.impostors[0];

  const voters = room.players.map((p: TestPlayer) => p.id);
  for (const voterId of voters) {
    engine.handleAction(room, voterId, "vote", { suspectId: impostorId });
  }

  assert.equal(room.phase, "result");
  assert.equal(room.round.eliminated, impostorId);
  assert.equal(room.round.wasImpostor, true);
  assert.deepEqual(room.round.matchEliminated, [impostorId]);
  assert.equal(room.round.matchOver, true, "the only impostor was just caught");
  assert.equal(room.round.winner, "innocents");
  assert.equal(room.roundHistory.length, 1);
  assert.equal(room.roundHistory[0].eliminated, impostorId);
  assert.equal(room.roundHistory[0].matchOver, true);
  assert.equal(room.roundHistory[0].winner, "innocents");
});

test("eliminating an innocent with impostors still outnumbered continues the match instead of ending it", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  }); // 4 players, 1 impostor
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: innocentId });

  assert.equal(room.phase, "result");
  assert.equal(room.round.eliminated, innocentId);
  assert.equal(room.round.wasImpostor, false);
  assert.equal(room.round.matchOver, false, "1 impostor vs 2 remaining innocents — not decided yet");
  assert.equal(room.round.winner, null);
});

test("continue_round starts a fresh round among the survivors, keeping the same impostor", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  });
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: innocentId });
  assert.equal(room.round.matchOver, false);

  const nonHost = room.players.find((p: TestPlayer) => p.id !== room.hostId)!.id;
  const nonHostAttempt = engine.handleAction(room, nonHost, "continue_round", {});
  assert.equal(nonHostAttempt.handled, false);

  const res = engine.handleAction(room, room.hostId, "continue_round", {});
  assert.equal(res.handled, true);
  assert.equal(room.phase, "round");
  assert.deepEqual([...room.round.impostors].sort(), [impostorId].sort());
  assert.deepEqual(room.round.matchEliminated, [innocentId]);
  assert.equal(room.round.turnOrder.length, 3, "the eliminated player isn't in this round's turn order");
  assert.ok(!room.round.turnOrder.includes(innocentId));
});

test("continue_round keeps the same word/category — it's still the same match, only a new match draws a fresh one", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  });
  engine.startRound(room);
  const { word, categoryKey } = room.round;
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: innocentId });
  engine.handleAction(room, room.hostId, "continue_round", {});

  assert.equal(room.round.word, word);
  assert.equal(room.round.categoryKey, categoryKey);
});

test("eliminating enough innocents that impostors reach parity ends the match with impostors winning", () => {
  const room = makeRoom({
    players: [1, 2, 3].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
    hostId: "p1",
  }); // 3 players, 1 impostor: 1 elimination of an innocent -> 1v1
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: innocentId });

  assert.equal(room.round.matchOver, true, "1 impostor vs 1 innocent — impostor can no longer be outvoted");
  assert.equal(room.round.winner, "impostors");
});

test("continue_round refuses once the match is already over", () => {
  const room = makeRoom({ hostId: "p1" });
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: impostorId });
  assert.equal(room.round.matchOver, true);

  const res = engine.handleAction(room, "p1", "continue_round", {});
  assert.equal(res.handled, false);
});

test("eliminated players can't vote or be voted for in later rounds", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
    hostId: "p1",
  });
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: innocentId });
  engine.handleAction(room, "p1", "continue_round", {});
  finishAllTurns(room);
  room.phase = "voting";

  const voteAsEliminated = engine.handleAction(room, innocentId, "vote", { suspectId: impostorId });
  assert.equal(voteAsEliminated.handled, false, "eliminated players can't vote");

  const survivor = room.round.turnOrder[0];
  const voteForEliminated = engine.handleAction(room, survivor, "vote", { suspectId: innocentId });
  assert.equal(voteForEliminated.handled, false, "eliminated players can't be voted for again");
});

test("revealOnElimination off hides that round's wasImpostor unless it ends the match", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), revealOnElimination: false },
  });
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const innocentId = room.players.find((p: TestPlayer) => p.id !== impostorId)!.id;

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: innocentId });

  assert.equal(room.round.matchOver, false);
  assert.equal(engine.getPublicRoundView(room).wasImpostor, undefined, "hidden mid-match when the setting is off");
  assert.equal(engine.getPublicRoundView(room).impostors, undefined, "roster never leaks before the match ends");
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
  assert.equal(room.round.rerollCount, 1, "the frontend diffs this to show a 'changing word' transition");
  assert.ok(
    room.players.every(p => p.ready === false),
    "readiness resets so everyone re-confirms the new word",
  );
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

  finishAllTurns(room); // -> discussion
  assert.equal(engine.getPhaseTimerEnd(room), room.round.discussionEnd);
});

test("forceReadyAndAdvance skips just the current turn when the round phase's timer fires", () => {
  const room = makeRoom();
  engine.startRound(room);

  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "round", "only one of the three turns elapsed");
  assert.equal(room.round.turnIndex, 1);

  engine.forceReadyAndAdvance(room);
  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "discussion", "all three turns are now done");
});

test("forceReadyAndAdvance marks every online player ready during discussion", () => {
  const room = makeRoom();
  engine.startRound(room);
  finishAllTurns(room); // -> discussion
  room.players[2].online = false;

  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "voting");
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
  const innocentId = room.players.find(p => p.id !== impostorId)!.id;

  assert.equal(engine.getPrivateView(room, impostorId).word, null);
  assert.equal(engine.getPrivateView(room, innocentId).word, room.round.word);
});

test("cancel_skip_word withdraws a pending skip vote", () => {
  const room = makeRoom();
  engine.startRound(room);

  engine.handleAction(room, "p1", "skip_word", {});
  assert.equal(room.round.skipVotes.length, 1);

  const res = engine.handleAction(room, "p1", "cancel_skip_word", {});
  assert.equal(res.handled, true);
  assert.equal(room.round.skipVotes.length, 0);
});

test("cancel_skip_word only works during the round phase", () => {
  const room = makeRoom();
  engine.startRound(room);
  finishAllTurns(room); // -> discussion

  const res = engine.handleAction(room, "p1", "cancel_skip_word", {});
  assert.equal(res.handled, false);
});

test("send_chat_message is rejected unless discussionMode is 'chat'", () => {
  const room = makeRoom(); // default discussionMode: "voice"
  engine.startRound(room);
  finishAllTurns(room); // -> discussion

  const res = engine.handleAction(room, "p1", "send_chat_message", { text: "hola" });
  assert.equal(res.handled, false);
  assert.deepEqual(room.round.chat, []);
});

test("send_chat_message is only accepted during discussion, from an alive player, with non-empty text", () => {
  const room = makeRoom({
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), discussionMode: "chat" },
  });
  engine.startRound(room);

  // Not discussion yet.
  const duringRound = engine.handleAction(room, "p1", "send_chat_message", { text: "hola" });
  assert.equal(duringRound.handled, false);

  finishAllTurns(room); // -> discussion

  const empty = engine.handleAction(room, "p1", "send_chat_message", { text: "   " });
  assert.equal(empty.handled, false);

  const res = engine.handleAction(room, "p1", "send_chat_message", { text: "  sospecho de p2  " });
  assert.equal(res.handled, true);
  assert.equal(room.round.chat.length, 1);
  assert.equal(room.round.chat[0].text, "sospecho de p2", "trimmed");
  assert.equal(room.round.chat[0].playerId, "p1");
  assert.equal(room.round.chat[0].name, "Ana");

  const longText = "x".repeat(400);
  engine.handleAction(room, "p2", "send_chat_message", { text: longText });
  assert.equal(room.round.chat[1].text.length, 300, "clamped to 300 chars");
});

test("getPublicRoundView only exposes chat when discussionMode is 'chat'", () => {
  const chatRoom = makeRoom({
    config: { ...engine.createConfig(), enabledCategories: allCategoriesEnabled(), discussionMode: "chat" },
  });
  engine.startRound(chatRoom);
  finishAllTurns(chatRoom);
  engine.handleAction(chatRoom, "p1", "send_chat_message", { text: "hola" });
  assert.deepEqual(engine.getPublicRoundView(chatRoom).chat, chatRoom.round.chat);

  const voiceRoom = makeRoom();
  engine.startRound(voiceRoom);
  finishAllTurns(voiceRoom);
  assert.equal(engine.getPublicRoundView(voiceRoom).chat, undefined);
});

test("new_game is host-only and only once the match is over, resetting the room to the lobby", () => {
  const room = makeRoom({ hostId: "p1" });
  engine.startRound(room);
  const impostorId = room.round.impostors[0];

  // Match still in progress: refused for anyone, including the host.
  const tooEarly = engine.handleAction(room, "p1", "new_game", {});
  assert.equal(tooEarly.handled, false);

  room.phase = "voting";
  for (const p of room.players) engine.handleAction(room, p.id, "vote", { suspectId: impostorId });
  assert.equal(room.round.matchOver, true);

  const nonHost = room.players.find((p: TestPlayer) => p.id !== room.hostId)!.id;
  const nonHostAttempt = engine.handleAction(room, nonHost, "new_game", {});
  assert.equal(nonHostAttempt.handled, false);

  const res = engine.handleAction(room, "p1", "new_game", {});
  assert.equal(res.handled, true);
  assert.equal(room.round, null);
  assert.equal(room.phase, "lobby");
  assert.ok(room.players.every((p: TestPlayer) => p.ready === false));
});

test("a tied vote triggers a revote among just the tied suspects", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  });
  engine.startRound(room);

  room.phase = "voting";
  // p1/p4 vote p3, p2/p3 vote p1 -> 2-2 tie between p1 and p3.
  engine.handleAction(room, "p1", "vote", { suspectId: "p3" });
  engine.handleAction(room, "p4", "vote", { suspectId: "p3" });
  engine.handleAction(room, "p2", "vote", { suspectId: "p1" });
  engine.handleAction(room, "p3", "vote", { suspectId: "p1" });

  assert.equal(room.phase, "voting", "still voting — a tie doesn't resolve the round");
  assert.equal(room.round.eliminated, null);
  assert.deepEqual([...room.round.revoteCandidates].sort(), ["p1", "p3"]);
  assert.equal(room.round.revoteCount, 1);
  assert.deepEqual(room.round.votes, {}, "votes reset for the revote");
});

test("a revote only accepts votes for the tied candidates", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  });
  engine.startRound(room);
  room.phase = "voting";
  engine.handleAction(room, "p1", "vote", { suspectId: "p3" });
  engine.handleAction(room, "p4", "vote", { suspectId: "p3" });
  engine.handleAction(room, "p2", "vote", { suspectId: "p1" });
  engine.handleAction(room, "p3", "vote", { suspectId: "p1" });
  assert.deepEqual([...room.round.revoteCandidates].sort(), ["p1", "p3"]);

  const rejected = engine.handleAction(room, "p1", "vote", { suspectId: "p2" });
  assert.equal(rejected.handled, false, "p2 isn't one of the tied candidates");

  const accepted = engine.handleAction(room, "p1", "vote", { suspectId: "p3" });
  assert.equal(accepted.handled, true);
});

test("a tie repeated past MAX_REVOTES is broken randomly instead of looping forever", () => {
  const room = makeRoom({
    players: [1, 2, 3, 4].map(n => ({ id: `p${n}`, name: `P${n}`, ready: false, online: true })),
  });
  engine.startRound(room);
  room.phase = "voting";

  // Same 2-2 tie, three times in a row (MAX_REVOTES = 2, so the third tie
  // must resolve instead of asking for yet another revote).
  for (let i = 0; i < 3; i++) {
    engine.handleAction(room, "p1", "vote", { suspectId: "p3" });
    engine.handleAction(room, "p4", "vote", { suspectId: "p3" });
    engine.handleAction(room, "p2", "vote", { suspectId: "p1" });
    engine.handleAction(room, "p3", "vote", { suspectId: "p1" });
  }

  assert.equal(room.phase, "result");
  assert.equal(room.round.tieBrokenRandomly, true);
  assert.ok(["p1", "p3"].includes(room.round.eliminated));
  assert.equal(room.roundHistory.at(-1).tieBrokenRandomly, true);
});

test("onPlayerOffline immediately advances the turn only when it's specifically that player's turn", () => {
  const room = makeRoom();
  engine.startRound(room);
  const [current, next] = room.round.turnOrder;

  // Someone else in the order going offline (not their turn yet) shouldn't
  // touch the current turn.
  engine.onPlayerOffline(room, next);
  assert.equal(room.round.turnIndex, 0);

  engine.onPlayerOffline(room, current);
  assert.equal(room.round.turnIndex, 1, "the current player's turn was skipped immediately");
  assert.equal(room.round.clues[current], "", "treated as an implicit pass, same as a timed-out turn");
});

test("onPlayerOffline is a no-op outside the round phase", () => {
  const room = makeRoom();
  engine.startRound(room);
  finishAllTurns(room); // -> discussion
  const someone = room.players[0].id;

  engine.onPlayerOffline(room, someone); // should not throw or change phase
  assert.equal(room.phase, "discussion");
});

test("votes already cast are discarded (and flagged) when the impostor is removed mid-voting", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];
  const bystander = room.players.find((p: TestPlayer) => p.id !== impostorId)!;

  room.phase = "voting";
  engine.handleAction(room, bystander.id, "vote", { suspectId: impostorId });
  assert.equal(Object.keys(room.round.votes).length, 1);

  room.players = room.players.filter((p: TestPlayer) => p.id !== impostorId);
  engine.maybeAdvance(room);

  assert.equal(room.round.matchOver, true);
  assert.equal(room.round.abortedReason, "impostor_disconnected");
  assert.equal(room.round.votesDiscarded, true, "a vote had already been cast when the abort happened");
  assert.equal(room.roundHistory.at(-1).votesDiscarded, true);
});

test("no votesDiscarded flag when the impostor is removed before voting even started", () => {
  const room = makeRoom();
  engine.startRound(room);
  const impostorId = room.round.impostors[0];

  room.players = room.players.filter((p: TestPlayer) => p.id !== impostorId);
  engine.maybeAdvance(room);

  assert.equal(room.round.abortedReason, "impostor_disconnected");
  assert.equal(room.round.votesDiscarded, false);
});

test("rerollWord falls back to a brand-new match (word_pool_exhausted) once its category runs out of words", () => {
  const [catA, catB] = Object.keys(CATEGORIES);
  const room = makeRoom({
    config: { ...engine.createConfig(), enabledCategories: { [catA]: true } },
  });
  engine.startRound(room);
  assert.equal(room.round.categoryKey, catA, "the only enabled category");

  // Exhaust catA completely (including the word currently in play), then
  // switch what's "active" to catB — same as a host changing categories
  // mid-match — so the fallback startRound has somewhere else to draw from.
  room.usedWords[catA] = [...(CATEGORIES[catA] as { words: string[] }).words];
  room.config.enabledCategories = { [catB]: true };

  const first = engine.handleAction(room, "p1", "skip_word", {});
  assert.equal(first.rerolled, undefined, "1 of 3 isn't a majority yet");
  const res = engine.handleAction(room, "p2", "skip_word", {});

  assert.equal(res.handled, true);
  assert.equal(res.rerolled, true);
  assert.equal(room.round.categoryKey, catB, "fell back to the only category with words left");
  assert.equal(room.round.restartedReason, "word_pool_exhausted");
  assert.deepEqual(room.round.matchEliminated, [], "a brand-new match, not a continuation");
});

// Data integrity, not engine behavior — but it belongs to the impostor's
// hint feature and would otherwise only surface as a silently missing hint
// in production the day someone adds a word without its match. words/hints
// are two parallel structures kept in sync by hand (see impostor-data's
// Category type), so nothing else catches a typo or omission automatically.
test("every word in every category has a matching hint, and vice versa", () => {
  for (const [key, cat] of Object.entries(CATEGORIES) as [string, { words: string[]; hints: Record<string, string> }][]) {
    const missing = cat.words.filter(w => !cat.hints[w]?.trim());
    const orphaned = Object.keys(cat.hints).filter(w => !cat.words.includes(w));
    assert.deepEqual(missing, [], `category "${key}" has words with no hint: ${missing.join(", ")}`);
    assert.deepEqual(orphaned, [], `category "${key}" has hints for words that don't exist: ${orphaned.join(", ")}`);
  }
});
