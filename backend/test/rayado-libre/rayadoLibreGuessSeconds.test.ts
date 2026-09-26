// ─── Rayado Libre: seconds left at each correct guess ───────────────────────
// The reveal screen explains each score ("adivinó con 57s"), so the engine
// keeps the whole seconds left on the clock when each guess landed — the
// same value scoreForGuess used. Only the reveal view carries it, it's reset
// every turn, and a round restored from an older snapshot gets it backfilled.

const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../src/games/rayado-libre/engine");

interface TestPlayer {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
}

function makeDrawingRoom(word = "Mariposa") {
  const room: any = {
    code: "TEST1",
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
      { id: "p3", name: "Caro", ready: false, online: true },
    ] as TestPlayer[],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
  };
  room.config.customWords = [word];
  room.config.totalRounds = 2;
  engine.startRound(room);
  engine.handleAction(room, room.round.drawerId, "choose_word", { word });
  const drawerId: string = room.round.drawerId;
  const [g1, g2] = room.players.filter((p: TestPlayer) => p.id !== drawerId).map((p: TestPlayer) => p.id);
  return { room, drawerId, g1, g2 };
}

test("a correct guess stores the whole seconds left on the clock, the same value that scored it", () => {
  const { room, g1 } = makeDrawingRoom();
  room.round.timerEnd = Date.now() + 57_500;
  engine.handleAction(room, g1, "guess", { text: "Mariposa" });

  assert.equal(room.round.guessSeconds[g1], 57);
  assert.equal(room.round.roundPoints[g1], 57);
});

test("wrong guesses and the drawer never get an entry", () => {
  const { room, drawerId, g1 } = makeDrawingRoom();
  engine.handleAction(room, g1, "guess", { text: "Perro" });
  assert.deepEqual(room.round.guessSeconds, {});
  assert.equal(room.round.guessSeconds[drawerId], undefined);
});

test("the seconds only go out in the reveal view, never while drawing", () => {
  const { room, g1, g2 } = makeDrawingRoom();
  room.round.timerEnd = Date.now() + 80_000;
  engine.handleAction(room, g1, "guess", { text: "Mariposa" });

  const drawing = engine.getPublicRoundView(room);
  assert.equal(drawing.guessSeconds, undefined);
  for (const p of room.players) assert.equal(engine.getPrivateView(room, p.id).guessSeconds, undefined);

  engine.handleAction(room, g2, "guess", { text: "Mariposa" });
  assert.equal(room.phase, "reveal");
  const reveal = engine.getPublicRoundView(room);
  assert.deepEqual(Object.keys(reveal.guessSeconds).sort(), [g1, g2].sort());
  // The clock before this guess made it jump — not the jumped value.
  assert.ok(reveal.guessSeconds[g1] >= 79 && reveal.guessSeconds[g1] <= 80);
  // g2 guessed after the jump to 60.
  assert.ok(reveal.guessSeconds[g2] >= 59 && reveal.guessSeconds[g2] <= 60);
});

test("the next turn starts with no seconds recorded", () => {
  const { room, g1 } = makeDrawingRoom();
  engine.handleAction(room, g1, "guess", { text: "Mariposa" });
  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "reveal");
  // "player_ready" lives in roomService; the engine only sees the flags.
  for (const p of room.players) p.ready = true;
  engine.maybeAdvance(room);

  assert.equal(room.phase, "choosing");
  assert.deepEqual(room.round.guessSeconds, {});
});

test("a round restored from an older snapshot gets guessSeconds backfilled", () => {
  const { room } = makeDrawingRoom();
  delete room.round.guessSeconds;
  engine.migrateRound(room);
  assert.deepEqual(room.round.guessSeconds, {});
});
