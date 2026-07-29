const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../src/games/tateti/engine");

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
    ],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
    ...overrides,
  };
}

test("startRound requires exactly 2 players", () => {
  const room = makeRoom({ players: [{ id: "p1", name: "Ana", ready: false, online: true }] });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound assigns X/O and picks a starter", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "round");
  assert.deepEqual(room.round.board, Array(9).fill(null));
  assert.ok(["p1", "p2"].includes(room.round.turn));
  assert.equal(room.round.marks[room.round.turn], "X");
});

test("startRound alternates the starting player across rematches", () => {
  const room = makeRoom();
  engine.startRound(room);
  const firstStarter = room.round.turn;
  room.phase = "result";
  room.round.winner = "draw";
  engine.startRound(room);
  assert.notEqual(room.round.turn, firstStarter);
});

test("mark places the current player's mark and advances the turn", () => {
  const room = makeRoom();
  engine.startRound(room);
  const starter = room.round.turn;
  const other = room.players.find(p => p.id !== starter)!.id;

  const res = engine.handleAction(room, starter, "mark", { index: 0 });
  assert.equal(res.handled, true);
  assert.equal(room.round.board[0], room.round.marks[starter]);
  assert.equal(room.round.turn, other);
});

test("mark rejects a move from the player who doesn't have the turn", () => {
  const room = makeRoom();
  engine.startRound(room);
  const starter = room.round.turn;
  const other = room.players.find(p => p.id !== starter)!.id;

  const res = engine.handleAction(room, other, "mark", { index: 0 });
  assert.equal(res.handled, false);
  assert.equal(room.round.board[0], null);
});

test("mark rejects an already-occupied cell", () => {
  const room = makeRoom();
  engine.startRound(room);
  const starter = room.round.turn;
  const other = room.players.find(p => p.id !== starter)!.id;
  engine.handleAction(room, starter, "mark", { index: 0 });

  const res = engine.handleAction(room, other, "mark", { index: 0 });
  assert.equal(res.handled, false);
});

test("mark rejects an out-of-range index", () => {
  const room = makeRoom();
  engine.startRound(room);
  const starter = room.round.turn;
  const res = engine.handleAction(room, starter, "mark", { index: 9 });
  assert.equal(res.handled, false);
});

test("a line of three ends the round with a winner and updates the score", () => {
  const room = makeRoom();
  engine.startRound(room);
  const starter = room.round.turn;
  const other = room.players.find(p => p.id !== starter)!.id;
  // starter: 0,1,2 (top row) / other: 3,4
  engine.handleAction(room, starter, "mark", { index: 0 });
  engine.handleAction(room, other, "mark", { index: 3 });
  engine.handleAction(room, starter, "mark", { index: 1 });
  engine.handleAction(room, other, "mark", { index: 4 });
  engine.handleAction(room, starter, "mark", { index: 2 });

  assert.equal(room.phase, "result");
  assert.equal(room.round.winner, starter);
  assert.deepEqual(room.round.winningLine, [0, 1, 2]);
  assert.equal(room.config.score[starter], 1);
});

test("a full board with no line ends the round in a draw", () => {
  const room = makeRoom();
  engine.startRound(room);
  const starter = room.round.turn;
  const other = room.players.find(p => p.id !== starter)!.id;
  // X O X / X O O / O X X -> no winner
  const order: [string, number][] = [
    [starter, 0],
    [other, 1],
    [starter, 2],
    [other, 4],
    [starter, 3],
    [other, 5],
    [starter, 7],
    [other, 6],
    [starter, 8],
  ];
  for (const [pid, idx] of order) engine.handleAction(room, pid, "mark", { index: idx });

  assert.equal(room.phase, "result");
  assert.equal(room.round.winner, "draw");
  assert.equal(room.config.draws, 1);
});

test("player_ready during result starts a rematch once both players are ready", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.phase = "result";
  room.round.winner = "draw";

  const res1 = engine.handleAction(room, "p1", "player_ready", {});
  assert.equal(res1.handled, true);
  assert.equal(room.phase, "result");

  engine.handleAction(room, "p2", "player_ready", {});
  assert.equal(room.phase, "round");
});

test("reset_score_vote only resets once both players vote", () => {
  const room = makeRoom();
  engine.startRound(room);
  room.config.score.p1 = 3;
  room.config.draws = 2;

  engine.handleAction(room, "p1", "reset_score_vote", {});
  assert.equal(room.config.score.p1, 3, "should not reset with only one vote");

  engine.handleAction(room, "p2", "reset_score_vote", {});
  assert.deepEqual(room.config.score, {});
  assert.equal(room.config.draws, 0);
});

test("getPublicRoundView exposes the board/turn/winner", () => {
  const room = makeRoom();
  engine.startRound(room);
  const view = engine.getPublicRoundView(room);
  assert.deepEqual(view.board, room.round.board);
  assert.equal(view.turn, room.round.turn);
});

test("getPublicRoundView returns null before a round starts", () => {
  const room = makeRoom();
  assert.equal(engine.getPublicRoundView(room), null);
});
