const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/sintonia/engine");

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

test("startRound enters setup phase with no round committed yet", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "setup");
  assert.equal(room.round, null);
});

test("startRound refuses below the minimum player count", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("confirm_round_setup is host-only", () => {
  const room = makeRoom();
  engine.startRound(room);
  const res = engine.handleAction(room, "p2", "confirm_round_setup", { psychicId: "p2" });
  assert.equal(res.handled, false);
  assert.equal(room.phase, "setup");
});

test("confirm_round_setup picks a spectrum and moves to the clue phase", () => {
  const room = makeRoom();
  engine.startRound(room);
  const res = engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2", spectrumMode: "random" });
  assert.equal(res.handled, true);
  assert.equal(res.rerolled, true);
  assert.equal(room.phase, "clue");
  assert.equal(room.round.psychicId, "p2");
  assert.ok(room.round.left && room.round.right);
  assert.ok(room.round.target >= 8 && room.round.target <= 92);
});

test("confirm_round_setup with manual spectrum uses the given left/right", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", {
    psychicId: "p2",
    spectrumMode: "manual",
    left: "Frío",
    right: "Caliente",
  });
  assert.equal(room.round.left, "Frío");
  assert.equal(room.round.right, "Caliente");
});

test("submit_clue is psychic-only and moves to the guess phase", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });

  const wrongPlayer = engine.handleAction(room, "p1", "submit_clue", { clue: "algo" });
  assert.equal(wrongPlayer.handled, false);

  const res = engine.handleAction(room, "p2", "submit_clue", { clue: "helado" });
  assert.equal(res.handled, true);
  assert.equal(room.round.clue, "helado");
  assert.equal(room.phase, "guess");
});

test("submit_guess rejects the psychic guessing on their own round", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });
  engine.handleAction(room, "p2", "submit_clue", { clue: "helado" });

  const res = engine.handleAction(room, "p2", "submit_guess", { value: 50 });
  assert.equal(res.handled, false);
});

test("submit_guess rejects out-of-range values", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });
  engine.handleAction(room, "p2", "submit_clue", { clue: "helado" });

  const res = engine.handleAction(room, "p1", "submit_guess", { value: 150 });
  assert.equal(res.handled, false);
});

test("once every non-psychic online player guesses, the round resolves and scores", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });
  engine.handleAction(room, "p2", "submit_clue", { clue: "helado" });
  const target = room.round.target;

  engine.handleAction(room, "p1", "submit_guess", { value: target });
  assert.equal(room.phase, "guess", "still waiting on p3");

  engine.handleAction(room, "p3", "submit_guess", { value: Math.max(0, target - 50) });

  assert.equal(room.phase, "result");
  assert.ok(room.round.pointsByPlayer.p1 >= room.round.pointsByPlayer.p3);
  // Psychic bonus = sum of every guesser's points
  const guesserSum = room.round.pointsByPlayer.p1 + room.round.pointsByPlayer.p3;
  assert.equal(room.round.psychicBonus, guesserSum);
  assert.equal(room.round.pointsByPlayer.p2, guesserSum);
  assert.equal(room.config.score.p2, guesserSum);
  assert.equal(room.roundHistory.length, 1);
});

test("maybeAdvance ignores offline non-psychic players when checking completion", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });
  engine.handleAction(room, "p2", "submit_clue", { clue: "helado" });
  room.players.find((p: TestPlayer) => p.id === "p3")!.online = false;

  engine.handleAction(room, "p1", "submit_guess", { value: 50 });
  assert.equal(room.phase, "result");
});

test("getPublicRoundView hides the target until result, exposes it after", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });
  engine.handleAction(room, "p2", "submit_clue", { clue: "helado" });

  const midView = engine.getPublicRoundView(room);
  assert.equal(midView.target, null);

  engine.handleAction(room, "p1", "submit_guess", { value: 10 });
  engine.handleAction(room, "p3", "submit_guess", { value: 20 });

  const resultView = engine.getPublicRoundView(room);
  assert.equal(resultView.target, room.round.target);
});

test("getPrivateView only reveals the target to the psychic", () => {
  const room = makeRoom();
  engine.startRound(room);
  engine.handleAction(room, "p1", "confirm_round_setup", { psychicId: "p2" });

  assert.equal(engine.getPrivateView(room, "p1").target, null);
  assert.equal(engine.getPrivateView(room, "p2").target, room.round.target);
});
