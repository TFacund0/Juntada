const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../src/games/tutifruti/engine");

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
  const config = engine.createConfig();
  Object.keys(config.activeCategories).forEach((id: string) => {
    config.activeCategories[id] = true;
  });
  return {
    code: "TEST1",
    hostId: "p1",
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
    ],
    config,
    round: null,
    usedWords: {},
    roundHistory: [],
    ...overrides,
  };
}

function startAndConfirmLetter(room: TestRoom) {
  engine.startRound(room);
  engine.handleAction(room, room.hostId, "confirm_letter", {});
}

test("startRound refuses below the minimum player count", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound refuses once every configured round has been played", () => {
  const room = makeRoom();
  room.config.rounds = 1;
  room.roundHistory = [{}];
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound picks a letter and enters setup", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "setup");
  assert.ok(room.round.letter);
  assert.ok(room.round.categories.length > 0);
});

test("confirm_letter is host-only", () => {
  const room = makeRoom();
  engine.startRound(room);
  const res = engine.handleAction(room, "p2", "confirm_letter", {});
  assert.equal(res.handled, false);
  assert.equal(room.phase, "setup");
});

test("confirm_letter with reroll swaps the letter without leaving setup", () => {
  const room = makeRoom();
  engine.startRound(room);
  const before = room.round.letter;
  const res = engine.handleAction(room, room.hostId, "confirm_letter", { reroll: true });
  assert.equal(res.handled, true);
  assert.equal(room.phase, "setup");
  assert.equal(room.round.rerollsUsed, 1);
  // Letter may coincidentally repeat with few letters used, but rerollsUsed proves it happened.
  void before;
});

test("confirm_letter without reroll moves to writing and starts the timer", () => {
  const room = makeRoom();
  engine.startRound(room);
  const res = engine.handleAction(room, room.hostId, "confirm_letter", {});
  assert.equal(res.handled, true);
  assert.equal(room.phase, "writing");
  assert.ok(room.round.timerEnd);
});

test("submit_answers stores only known category ids, trimmed to 60 chars", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const catId = room.round.categories[0].id;
  const longWord = "x".repeat(100);

  const res = engine.handleAction(room, "p1", "submit_answers", { answers: { [catId]: longWord, bogus_cat: "y" } });
  assert.equal(res.handled, true);
  assert.equal(room.round.answers.p1[catId].length, 60);
  assert.equal(room.round.answers.p1.bogus_cat, undefined);
});

test("player_ready moves to review once every online player is ready", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);

  engine.handleAction(room, "p1", "player_ready", {});
  assert.equal(room.phase, "writing");

  engine.handleAction(room, "p2", "player_ready", {});
  assert.equal(room.phase, "review");
});

test("call_basta only works in basta mode and jumps straight to review", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const rejected = engine.handleAction(room, "p1", "call_basta", {});
  assert.equal(rejected.handled, false, "endMode defaults to timer");

  const room2 = makeRoom();
  room2.config.endMode = "basta";
  startAndConfirmLetter(room2);
  const res = engine.handleAction(room2, "p1", "call_basta", {});
  assert.equal(res.handled, true);
  assert.equal(room2.phase, "review");
  assert.equal(room2.round.bastaBy, "p1");
});

test("mark_word rejects marking a category/player that never answered", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});
  const catId = room.round.categories[0].id;

  const res = engine.handleAction(room, "p1", "mark_word", { targetPlayerId: "p2", categoryId: catId, valid: true });
  assert.equal(res.handled, false, "p2 never wrote anything for this category");
});

test("mark_word records a vote once the target actually answered", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const catId = room.round.categories[0].id;
  engine.handleAction(room, "p2", "submit_answers", { answers: { [catId]: "Zapallo" } });
  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});

  const res = engine.handleAction(room, "p1", "mark_word", { targetPlayerId: "p2", categoryId: catId, valid: true });
  assert.equal(res.handled, true);
  assert.equal(room.round.marks.p2[catId].p1, true);
});

test("confirm_review tallies points once every online player confirms", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const catId = room.round.categories[0].id;
  engine.handleAction(room, "p1", "submit_answers", { answers: { [catId]: `${room.round.letter}orro` } });
  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});

  engine.handleAction(room, "p1", "confirm_review", {});
  assert.equal(room.phase, "review", "still waiting on p2");

  engine.handleAction(room, "p2", "confirm_review", {});
  assert.equal(room.phase, "result");
  assert.equal(room.round.pointsByPlayer.p1, 20); // only valid answer in the category (0 votes defaults to valid)
  assert.equal(room.config.score.p1, 20);
  assert.equal(room.roundHistory.length, 1);
});

test("a tied vote (half invalid) rejects the word, and being the only valid answer earns 20", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const catId = room.round.categories[0].id;
  const letter = room.round.letter;
  engine.handleAction(room, "p1", "submit_answers", { answers: { [catId]: `${letter}orro` } });
  engine.handleAction(room, "p2", "submit_answers", { answers: { [catId]: `${letter}uto` } });
  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});

  // p2's word gets one tick and one cross — a tie counts as half invalid, so it's rejected.
  engine.handleAction(room, "p1", "mark_word", { targetPlayerId: "p2", categoryId: catId, valid: true });
  engine.handleAction(room, "p2", "mark_word", { targetPlayerId: "p2", categoryId: catId, valid: false });

  engine.handleAction(room, "p1", "confirm_review", {});
  engine.handleAction(room, "p2", "confirm_review", {});

  assert.equal(room.round.breakdown.p2[catId].valid, false);
  assert.equal(room.round.pointsByPlayer.p2, 0);
  // p1 is the only valid word in the category → bonus 20 instead of 10.
  assert.equal(room.round.breakdown.p1[catId].valid, true);
  assert.equal(room.round.pointsByPlayer.p1, 20);
});

test("finishRound flags a word that doesn't start with the round letter as invalid", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const catId = room.round.categories[0].id;
  const wrongLetter = room.round.letter === "A" ? "Zorro" : "Auto";
  engine.handleAction(room, "p1", "submit_answers", { answers: { [catId]: wrongLetter } });
  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});
  engine.handleAction(room, "p1", "confirm_review", {});
  engine.handleAction(room, "p2", "confirm_review", {});

  assert.equal(room.round.breakdown.p1[catId].wrongLetter, true);
  assert.equal(room.round.breakdown.p1[catId].valid, false);
  assert.equal(room.round.pointsByPlayer.p1, 0);
});

test("getPublicRoundView hides answers/marks until review", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const writingView = engine.getPublicRoundView(room);
  assert.equal(writingView.answers, undefined);

  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});
  const reviewView = engine.getPublicRoundView(room);
  assert.ok(reviewView.answers);
});

test("getPrivateView only reveals a player's own answers, and only while writing", () => {
  const room = makeRoom();
  startAndConfirmLetter(room);
  const catId = room.round.categories[0].id;
  engine.handleAction(room, "p1", "submit_answers", { answers: { [catId]: "Auto" } });

  const view = engine.getPrivateView(room, "p1");
  assert.equal(view!.myAnswers[catId], "Auto");

  engine.handleAction(room, "p1", "player_ready", {});
  engine.handleAction(room, "p2", "player_ready", {});
  assert.equal(engine.getPrivateView(room, "p1"), null);
});
