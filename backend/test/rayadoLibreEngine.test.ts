const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/rayado-libre/engine");

interface TestPlayer {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
}
interface TestRoom {
  code: string;
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

function enableAllCategories(room: TestRoom): void {
  Object.keys(room.config.enabledCategories).forEach((k: string) => {
    room.config.enabledCategories[k] = true;
  });
}

// Reveal has no timer of its own — the only way to move past it is every
// online player confirming via "player_ready" (see engine.ts).
function confirmAllReady(room: TestRoom): void {
  room.players.forEach((p: TestPlayer) => engine.handleAction(room, p.id, "player_ready", {}));
}

test("startRound requires at least 3 players", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  enableAllCategories(room);
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound requires an active category", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound offers the first drawer 3 word choices and enters choosing", () => {
  const room = makeRoom();
  enableAllCategories(room);
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "choosing");
  assert.equal(room.round.wordChoices.length, 3);
  assert.equal(room.round.totalTurns, room.players.length * room.config.totalRounds);
});

test("choose_word moves to drawing and starts the 99s timer", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];

  const res = engine.handleAction(room, drawerId, "choose_word", { word });
  assert.equal(res.handled, true);
  assert.equal(room.phase, "drawing");
  assert.equal(room.round.word, word);
  assert.equal(room.round.wordChoices, null);
  assert.ok(room.round.timerEnd > Date.now());
});

test("choose_word rejects a word that wasn't offered, or from a non-drawer", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const other = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;

  assert.equal(engine.handleAction(room, drawerId, "choose_word", { word: "no-existe-esta-palabra" }).handled, false);
  assert.equal(engine.handleAction(room, other, "choose_word", { word: room.round.wordChoices[0] }).handled, false);
});

test("a correct guess in the 60-99s zone scores a flat 60 and jumps the timer to 60s", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;

  const res = engine.handleAction(room, guesser, "guess", { text: word });
  assert.equal(res.handled, true);
  assert.equal(room.config.score[guesser], 60);
  assert.equal(room.config.score[drawerId], 10);
  assert.ok(room.round.correctGuessers.includes(guesser));
  // Timer jumped down to (approximately) 60s remaining, well below the full 99s.
  const remaining = Math.ceil((room.round.timerEnd - Date.now()) / 1000);
  assert.ok(remaining <= 60 && remaining > 55, `expected ~60s remaining, got ${remaining}`);
});

test("a guess at 59.8s remaining (real time) scores as zone 2 (59), not zone 1's flat 60 — no rounding-up bias at the boundary", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  room.round.timerEnd = Date.now() + 59_800; // 59.8s of real time left

  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  engine.handleAction(room, guesser, "guess", { text: word });
  assert.equal(room.config.score[guesser], 59, "Math.ceil would round 59.8 up to 60 and wrongly award the flat zone-1 score");
});

test("a guess in the 0-30s zone scores exactly the seconds remaining, with no further jump", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  room.round.timerEnd = Date.now() + 20_000; // simulate the turn almost over

  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  engine.handleAction(room, guesser, "guess", { text: word });
  assert.ok(room.config.score[guesser] >= 18 && room.config.score[guesser] <= 20);
});

test("a wrong guess is logged in chat and doesn't score", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  engine.handleAction(room, drawerId, "choose_word", { word: room.round.wordChoices[0] });
  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;

  engine.handleAction(room, guesser, "guess", { text: "definitivamente-incorrecto" });
  assert.equal(room.config.score[guesser], undefined);
  assert.equal(room.round.chatLog.at(-1).type, "chat");
});

test("a player can't score twice in the same turn", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;

  engine.handleAction(room, guesser, "guess", { text: word });
  const scoreAfterFirst = room.config.score[guesser];
  const res = engine.handleAction(room, guesser, "guess", { text: word });
  assert.equal(res.handled, false);
  assert.equal(room.config.score[guesser], scoreAfterFirst);
});

test("once every online non-drawer player has guessed, the turn ends early into reveal", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  const others = room.players.filter((p: TestPlayer) => p.id !== drawerId);

  engine.handleAction(room, others[0].id, "guess", { text: word });
  assert.equal(room.phase, "drawing");
  engine.handleAction(room, others[1].id, "guess", { text: word });
  assert.equal(room.phase, "reveal");
});

test("draw_stroke/draw_fill/draw_clear are only accepted from the drawer during drawing", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const other = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  engine.handleAction(room, drawerId, "choose_word", { word: room.round.wordChoices[0] });

  assert.equal(engine.handleAction(room, other, "draw_stroke", { points: [[0, 0]], color: "#000", size: 4 }).handled, false);
  const strokeRes = engine.handleAction(room, drawerId, "draw_stroke", { points: [[0, 0]], color: "#000", size: 4 });
  assert.equal(strokeRes.handled, true);
  assert.equal(room.round.strokes.length, 1);

  engine.handleAction(room, drawerId, "draw_fill", { x: 5, y: 5, color: "#fff" });
  assert.equal(room.round.strokes.length, 2);

  engine.handleAction(room, drawerId, "draw_clear", {});
  assert.equal(room.round.strokes.length, 0);
});

test("draw_undo removes a whole gesture's worth of chunks, or just a single fill/clear, and is drawer-only", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const other = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  engine.handleAction(room, drawerId, "choose_word", { word: room.round.wordChoices[0] });

  engine.handleAction(room, drawerId, "draw_stroke", { points: [[0, 0]], color: "#000", size: 4, strokeId: 1 });
  engine.handleAction(room, drawerId, "draw_stroke", { points: [[1, 1]], color: "#000", size: 4, strokeId: 1 });
  engine.handleAction(room, drawerId, "draw_stroke", { points: [[2, 2]], color: "#000", size: 4, strokeId: 2 });
  assert.equal(room.round.strokes.length, 3);

  assert.equal(engine.handleAction(room, other, "draw_undo", {}).handled, false);

  engine.handleAction(room, drawerId, "draw_undo", {});
  assert.equal(room.round.strokes.length, 2, "removes strokeId 2's single chunk");
  engine.handleAction(room, drawerId, "draw_undo", {});
  assert.equal(room.round.strokes.length, 0, "removes both chunks sharing strokeId 1 at once");
});

test("getPublicRoundView exposes a length-accurate wordHint during drawing that never reveals the full word", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const word = room.round.wordChoices[0];
  engine.handleAction(room, room.round.drawerId, "choose_word", { word });

  const view = engine.getPublicRoundView(room);
  assert.equal(view.wordHint.length, word.length);
  assert.notEqual(view.wordHint, word, "shouldn't ever leak the real word verbatim this early");
});

test("getPublicRoundView doesn't crash on a round persisted from before hintOrder/drawingStartedAt existed", () => {
  // Simulates a room restored from an older Redis snapshot (or a rejoin into
  // a room that started before this server picked up the hint feature) —
  // the round object is missing fields a fresh startRound would always set.
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const word = room.round.wordChoices[0];
  engine.handleAction(room, room.round.drawerId, "choose_word", { word });
  delete room.round.hintOrder;
  delete room.round.drawingStartedAt;

  const view = engine.getPublicRoundView(room);
  assert.equal(typeof view.wordHint, "string");
  assert.equal(view.wordHint.length, word.length);
  // Backfilled onto the round so subsequent calls stay consistent instead of
  // regenerating (and reshuffling) the hint order on every single broadcast.
  assert.ok(Array.isArray(room.round.hintOrder));
  assert.ok(room.round.drawingStartedAt);
});

test("forceReadyAndAdvance auto-picks a word if choosing timed out", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  assert.equal(room.round.word, null);

  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "drawing");
  assert.ok(room.round.word);
});

test("forceReadyAndAdvance ends the drawing turn into reveal, then reveal advances to the next drawer", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
  const firstDrawer = room.round.drawerId;

  engine.forceReadyAndAdvance(room); // drawing -> reveal
  assert.equal(room.phase, "reveal");

  confirmAllReady(room); // reveal -> next choosing
  assert.equal(room.phase, "choosing");
  assert.notEqual(room.round.drawerId, firstDrawer);
});

test("getPublicRoundView never exposes the word or wordChoices before reveal", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  let view = engine.getPublicRoundView(room);
  assert.equal(view.wordChoices, undefined);
  assert.equal(view.word, undefined);

  engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
  view = engine.getPublicRoundView(room);
  assert.equal(view.word, undefined);
  assert.ok(Array.isArray(view.strokes));
});

test("getPrivateView only reveals wordChoices to the drawer while choosing", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const other = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;

  assert.deepEqual(engine.getPrivateView(room, drawerId).wordChoices, room.round.wordChoices);
  assert.equal(engine.getPrivateView(room, other).wordChoices, undefined);
});

test("getPrivateView reveals the actual word to the drawer throughout drawing, and never to anyone else", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const other = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });

  assert.equal(engine.getPrivateView(room, drawerId).word, word);
  assert.equal(engine.getPrivateView(room, other).word, undefined);
});

test("reveal only advances once every online player confirms ready, one at a time", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
  const firstDrawer = room.round.drawerId;
  engine.forceReadyAndAdvance(room); // drawing -> reveal
  assert.equal(room.phase, "reveal");

  const [p1, p2, p3] = room.players;
  engine.handleAction(room, p1.id, "player_ready", {});
  assert.equal(room.phase, "reveal", "should still wait after only 1 of 3 confirmed");
  engine.handleAction(room, p2.id, "player_ready", {});
  assert.equal(room.phase, "reveal", "should still wait after only 2 of 3 confirmed");
  engine.handleAction(room, p3.id, "player_ready", {});
  assert.equal(room.phase, "choosing", "should advance once every player confirmed");
  assert.notEqual(room.round.drawerId, firstDrawer);
});

test("reveal has no timer of its own — getPhaseTimerEnd returns null and forceReadyAndAdvance is a no-op there", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
  engine.forceReadyAndAdvance(room); // drawing -> reveal
  assert.equal(room.phase, "reveal");
  assert.equal(engine.getPhaseTimerEnd(room), null);

  engine.forceReadyAndAdvance(room); // no scheduled timer ever calls this for "reveal", but confirm it's harmless
  assert.equal(room.phase, "reveal", "reveal only advances via player_ready, never on its own");
});

test("player_ready reports 'rerolled' so the new drawer's private word choices actually get sent", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
  engine.forceReadyAndAdvance(room); // drawing -> reveal

  const [p1, p2, p3] = room.players;
  engine.handleAction(room, p1.id, "player_ready", {});
  engine.handleAction(room, p2.id, "player_ready", {});
  const res = engine.handleAction(room, p3.id, "player_ready", {});
  assert.equal(room.phase, "choosing");
  assert.equal(res.rerolled, true, "must be true so the transport re-sends private_role to the new drawer");

  const newDrawerId = room.round.drawerId;
  const privateView = engine.getPrivateView(room, newDrawerId);
  assert.ok(Array.isArray(privateView.wordChoices) && privateView.wordChoices.length === 3);
});

test("getPublicRoundView keeps the chat log visible in the reveal phase", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  engine.handleAction(room, guesser, "guess", { text: "algo incorrecto" });

  engine.forceReadyAndAdvance(room); // drawing -> reveal
  const view = engine.getPublicRoundView(room);
  assert.equal(view.chatLog.length, 1);
  assert.equal(view.chatLog[0].type, "chat");
});

test("getPublicRoundView exposes roundPoints (this turn only) for both the guesser and the drawer, reset for the next turn", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  const word = room.round.wordChoices[0];
  engine.handleAction(room, drawerId, "choose_word", { word });
  const guesser = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;
  engine.handleAction(room, guesser, "guess", { text: word });
  engine.forceReadyAndAdvance(room); // drawing -> reveal (only one of two guessers answered — simulates the timer running out)

  const revealView = engine.getPublicRoundView(room);
  assert.equal(revealView.roundPoints[guesser], room.config.score[guesser]);
  assert.equal(revealView.roundPoints[drawerId], room.config.score[drawerId]);

  confirmAllReady(room); // -> next turn's "choosing"
  const nextTurnDrawerId = room.round.drawerId;
  engine.handleAction(room, nextTurnDrawerId, "choose_word", { word: room.round.wordChoices[0] });
  engine.forceReadyAndAdvance(room); // drawing -> reveal, nobody guessed this time
  assert.deepEqual(engine.getPublicRoundView(room).roundPoints, {});
});

test("onPlayerOffline auto-picks a word immediately if the drawer disconnects mid-choosing, instead of waiting out the full 15s timer", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  assert.equal(room.phase, "choosing");
  assert.equal(room.round.word, null);

  engine.onPlayerOffline(room, drawerId);
  assert.equal(room.phase, "drawing");
  assert.ok(room.round.word);
});

test("onPlayerOffline ends the drawing turn into reveal immediately if the drawer disconnects mid-turn", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  engine.handleAction(room, drawerId, "choose_word", { word: room.round.wordChoices[0] });
  assert.equal(room.phase, "drawing");

  engine.onPlayerOffline(room, drawerId);
  assert.equal(room.phase, "reveal");
});

test("onPlayerOffline does nothing when it's not the drawer who disconnected", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const drawerId = room.round.drawerId;
  engine.handleAction(room, drawerId, "choose_word", { word: room.round.wordChoices[0] });
  const other = room.players.find((p: TestPlayer) => p.id !== drawerId)!.id;

  engine.onPlayerOffline(room, other);
  assert.equal(room.phase, "drawing", "only the drawer disconnecting should skip ahead");
});

test("player_ready is rejected outside the reveal phase", () => {
  const room = makeRoom();
  enableAllCategories(room);
  engine.startRound(room);
  const res = engine.handleAction(room, room.players[0].id, "player_ready", {});
  assert.equal(res.handled, false);
});

test("the whole game ends in result once every turn has been played", () => {
  const room = makeRoom();
  room.config.totalRounds = 1;
  enableAllCategories(room);
  engine.startRound(room);

  for (let i = 0; i < room.players.length; i++) {
    engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
    engine.forceReadyAndAdvance(room); // drawing -> reveal
    confirmAllReady(room); // reveal -> next turn (or result)
  }

  assert.equal(room.phase, "result");
});

test("new_game is host-only, resets the accumulated score, and sends the room back to the lobby", () => {
  const room: any = makeRoom({ hostId: "p1" } as any);
  room.hostId = "p1";
  room.config.totalRounds = 1;
  enableAllCategories(room);
  engine.startRound(room);

  for (let i = 0; i < room.players.length; i++) {
    engine.handleAction(room, room.round.drawerId, "choose_word", { word: room.round.wordChoices[0] });
    const guesser = room.players.find((p: TestPlayer) => p.id !== room.round.drawerId)!.id;
    engine.handleAction(room, guesser, "guess", { text: room.round.word });
    engine.forceReadyAndAdvance(room); // drawing -> reveal (in case not everyone guessed)
    confirmAllReady(room); // reveal -> next turn (or result)
  }
  assert.ok(Object.keys(room.config.score).length > 0);

  const wrongPlayer = engine.handleAction(room, "p2", "new_game", {});
  assert.equal(wrongPlayer.handled, false);

  const res = engine.handleAction(room, "p1", "new_game", {});
  assert.equal(res.handled, true);
  assert.deepEqual(room.config.score, {});
  assert.equal(room.round, null);
  assert.equal(room.phase, "lobby");
});
