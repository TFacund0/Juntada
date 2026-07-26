const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/color-correcto/engine");

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

test("startRound enters the show phase with a fresh target and a timer", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "show");
  assert.match(room.round.target, /^#[0-9a-f]{6}$/);
  assert.ok(room.round.showEndsAt > Date.now());
  assert.deepEqual(room.round.guesses, {});
});

test("startRound refuses below the minimum player count", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound refuses once the configured round limit is reached", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), playMode: "rounds", roundLimit: 1 }, roundHistory: [{}] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("maybeAdvance moves show to guess once the show timer has elapsed", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.round.showEndsAt = Date.now() - 1; // force it into the past
  engine.maybeAdvance(room);
  assert.equal(room.phase, "guess");
});

test("forceReadyAndAdvance also moves show to guess (the phase-timer-expired path)", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "guess");
});

test("submit_guess is rejected outside the guess phase", () => {
  const room = makeRoom();
  engine.startRound(room); // still "show"
  const res = engine.handleAction(room, "p1", "submit_guess", { value: "#112233" });
  assert.equal(res.handled, false);
});

test("submit_guess rejects malformed hex values", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room); // -> guess
  const res = engine.handleAction(room, "p1", "submit_guess", { value: "not-a-color" });
  assert.equal(res.handled, false);
});

test("submit_guess locks in the first value — a second submit from the same player is rejected", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  const first = engine.handleAction(room, "p1", "submit_guess", { value: "#112233" });
  assert.equal(first.handled, true);
  const second = engine.handleAction(room, "p1", "submit_guess", { value: "#445566" });
  assert.equal(second.handled, false);
  assert.equal(room.round.guesses.p1, "#112233");
});

test("once every online player guesses, the round resolves and scores exact matches at 10", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room); // -> guess
  const target = room.round.target;

  engine.handleAction(room, "p1", "submit_guess", { value: target });
  assert.equal(room.phase, "guess", "still waiting on p2");

  engine.handleAction(room, "p2", "submit_guess", { value: "#000000" });

  assert.equal(room.phase, "result");
  assert.equal(room.round.scores.p1, 10);
  assert.ok(room.round.scores.p2 < room.round.scores.p1);
  assert.equal(room.config.score.p1, 10);
  assert.equal(room.roundHistory.length, 1);
});

test("maybeAdvance ignores offline players when checking completion", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  room.players.find((p: TestPlayer) => p.id === "p2")!.online = false;

  engine.handleAction(room, "p1", "submit_guess", { value: "#123456" });
  assert.equal(room.phase, "result");
});

test("force_finish_round is host-only and scores whoever already guessed", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  engine.handleAction(room, "p1", "submit_guess", { value: "#123456" });

  const wrongPlayer = engine.handleAction(room, "p2", "force_finish_round", {});
  assert.equal(wrongPlayer.handled, false);
  assert.equal(room.phase, "guess");

  const res = engine.handleAction(room, "p1", "force_finish_round", {});
  assert.equal(res.handled, true);
  assert.equal(room.phase, "result");
  assert.ok(room.round.scores.p1 != null);
  assert.equal(room.round.scores.p2, undefined);
});

test("a configured guess timer schedules its own phase timer end and forceReadyAndAdvance finishes the round with it", () => {
  const room = makeRoom({ config: { ...engine.createConfig(), guessSeconds: 5 } });
  engine.startRound(room);
  engine.forceReadyAndAdvance(room); // -> guess, guessEndsAt should now be set
  assert.ok(room.round.guessEndsAt > Date.now());
  assert.equal(engine.getPhaseTimerEnd(room), room.round.guessEndsAt);

  engine.handleAction(room, "p1", "submit_guess", { value: "#123456" });
  engine.forceReadyAndAdvance(room); // guess timer ran out
  assert.equal(room.phase, "result");
  assert.ok(room.round.scores.p1 != null);
});

test("without a configured guess timer, entering guess sets no phase timer", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  assert.equal(room.round.guessEndsAt, null);
  assert.equal(engine.getPhaseTimerEnd(room), null);
});

test("getPublicRoundView hides the target during guess, exposes it during show/result", () => {
  const room = makeRoom();
  engine.startRound(room); // show

  const showView = engine.getPublicRoundView(room);
  assert.equal(showView.target, room.round.target);

  engine.forceReadyAndAdvance(room); // guess
  const guessView = engine.getPublicRoundView(room);
  assert.equal(guessView.target, null);

  engine.handleAction(room, "p1", "submit_guess", { value: "#112233" });
  engine.handleAction(room, "p2", "submit_guess", { value: "#445566" });
  const resultView = engine.getPublicRoundView(room);
  assert.equal(resultView.target, room.round.target);
  assert.deepEqual(resultView.guesses, room.round.guesses);
  assert.deepEqual(resultView.scores, room.round.scores);
});

test("getPrivateView reflects a player's own locked-in guess", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  assert.equal(engine.getPrivateView(room, "p1").myGuess, null);

  engine.handleAction(room, "p1", "submit_guess", { value: "#abcdef" });
  assert.equal(engine.getPrivateView(room, "p1").myGuess, "#abcdef");
  assert.equal(engine.getPrivateView(room, "p2").myGuess, null);
});

test("new_game is host-only and resets score and round history", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.forceReadyAndAdvance(room);
  engine.handleAction(room, "p1", "submit_guess", { value: room.round.target });
  engine.handleAction(room, "p2", "submit_guess", { value: room.round.target });
  assert.ok(room.roundHistory.length > 0);
  assert.ok(Object.keys(room.config.score).length > 0);

  const wrongPlayer = engine.handleAction(room, "p2", "new_game", {});
  assert.equal(wrongPlayer.handled, false);

  const res = engine.handleAction(room, "p1", "new_game", {});
  assert.equal(res.handled, true);
  assert.deepEqual(room.config.score, {});
  assert.equal(room.roundHistory.length, 0);
  assert.equal(room.phase, "lobby");
  assert.equal(room.round, null);
});
