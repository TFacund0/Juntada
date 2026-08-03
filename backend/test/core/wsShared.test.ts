// ─── ws/shared.ts: scheduleOfflineReaction ──────────────────────────────────
// Verifies the grace period between a player going offline and a game's own
// onPlayerOffline reaction actually firing — the whole point being that a
// brief disconnect (bad signal, answering a text) shouldn't cost anyone
// their turn the instant the socket drops.

const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { rooms, clients } = require("../../src/state/roomStore");
const roomService = require("../../src/rooms/roomService");
const { scheduleOfflineReaction } = require("../../src/ws/shared");
const rayadoEngine = require("../../src/games/rayado-libre/engine");
const { fakeSocket } = require("../testUtils");

beforeEach(() => {
  rooms.clear();
  clients.clear();
});

function makeDrawingRoom() {
  const { room } = roomService.createRoom(fakeSocket(), { playerName: "Ana", gameType: "rayado-libre" });
  roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Beto" });
  roomService.joinRoom(fakeSocket(), { code: room.code, playerName: "Caro" });
  Object.keys(room.config.enabledCategories).forEach((k: string) => {
    room.config.enabledCategories[k] = true;
  });
  rayadoEngine.startRound(room);
  const drawerId = room.round.drawerId;
  rayadoEngine.handleAction(room, drawerId, "choose_word", { word: room.round.wordChoices[0] });
  return { room, drawerId };
}

test("scheduleOfflineReaction leaves the turn alone before the grace period elapses", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, drawerId } = makeDrawingRoom();
  room.players.find((p: any) => p.id === drawerId).online = false;

  scheduleOfflineReaction(room.code, drawerId);
  t.mock.timers.tick(59_000);
  assert.equal(room.phase, "drawing", "should still be waiting — the minute hasn't fully elapsed");
});

test("scheduleOfflineReaction reacts (ends the drawer's turn) once a full minute of being offline has passed", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, drawerId } = makeDrawingRoom();
  room.players.find((p: any) => p.id === drawerId).online = false;

  scheduleOfflineReaction(room.code, drawerId);
  t.mock.timers.tick(60_000);
  assert.equal(room.phase, "reveal", "the drawer's turn should have ended once the grace period ran out");
});

test("scheduleOfflineReaction does nothing if the player reconnected before the grace period elapsed", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, drawerId } = makeDrawingRoom();
  room.players.find((p: any) => p.id === drawerId).online = false;

  scheduleOfflineReaction(room.code, drawerId);
  room.players.find((p: any) => p.id === drawerId).online = true; // reconnected

  t.mock.timers.tick(60_000);
  assert.equal(room.phase, "drawing", "reconnecting in time should cancel the reaction");
});

test("repeated disconnects within the grace period only ever end the turn once, not once per call", (t: any) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { room, drawerId } = makeDrawingRoom();
  room.players.find((p: any) => p.id === drawerId).online = false;

  // A flaky connection re-scheduling on every drop used to stack a fresh,
  // untracked setTimeout each time instead of replacing the pending one —
  // once the grace period ran out, every stacked timer fired in turn and
  // called the engine's onPlayerOffline reaction again for each one.
  scheduleOfflineReaction(room.code, drawerId);
  t.mock.timers.tick(10_000);
  scheduleOfflineReaction(room.code, drawerId);
  t.mock.timers.tick(10_000);
  scheduleOfflineReaction(room.code, drawerId);

  t.mock.timers.tick(60_000);
  assert.equal(room.phase, "reveal", "the (single) reaction should have ended the drawer's turn");

  const phaseAfterFirstReaction = room.phase;
  t.mock.timers.tick(60_000);
  assert.equal(room.phase, phaseAfterFirstReaction, "no further stacked timer should still be pending to fire again");
});
