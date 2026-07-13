const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/torneo-fifa/engine");

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

function makePlayers(n: number): TestPlayer[] {
  return Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ready: false, online: true }));
}

function makeRoom(overrides: Partial<TestRoom> = {}): TestRoom {
  const players = overrides.players ?? makePlayers(4);
  return {
    code: "TEST1",
    hostId: players[0].id,
    players,
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
    ...overrides,
  };
}

function assignAllTeams(room: TestRoom) {
  room.players.forEach((p, i) => {
    room.config.assignments[p.id] = room.config.teams[i];
  });
}

test("startRound refuses below the minimum player count", () => {
  const room = makeRoom({ players: makePlayers(1) });
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound refuses if not every player has a team assigned", () => {
  const room = makeRoom();
  const res = engine.startRound(room);
  assert.ok(res.error);
  assert.match(res.error, /equipo/i);
});

test("startRound refuses if there aren't enough teams for every player", () => {
  const room = makeRoom({ players: makePlayers(10) });
  assignAllTeams(room);
  const res = engine.startRound(room);
  assert.ok(res.error);
});

test("startRound builds a bracket once teams are assigned", () => {
  const room = makeRoom();
  assignAllTeams(room);
  const res = engine.startRound(room);
  assert.equal(res.success, true);
  assert.equal(room.phase, "round");
  assert.equal(room.round.rounds[0].length, 2); // 4 players -> 2 first-round matches
  assert.equal(room.round.rounds.length, 2); // semifinal + final
});

test("a non-power-of-2 player count gets byes distributed to trailing entrants", () => {
  const room = makeRoom({ players: makePlayers(3) });
  assignAllTeams(room);
  engine.startRound(room);
  // size rounds up to 4 -> 1 bye
  const round0 = room.round.rounds[0];
  const byes = round0.filter((m: any) => m.b === null);
  assert.equal(byes.length, 1);
  assert.ok(byes[0].winner); // bye auto-advances
});

test("report_result is host-only", () => {
  const room = makeRoom();
  assignAllTeams(room);
  engine.startRound(room);
  const nonHost = room.players[1].id;
  const res = engine.handleAction(room, nonHost, "report_result", { roundIdx: 0, matchIdx: 0, goalsA: 2, goalsB: 1 });
  assert.equal(res.handled, false);
});

test("report_result with goals decides the winner and propagates to the next round", () => {
  const room = makeRoom();
  assignAllTeams(room);
  engine.startRound(room);

  const res = engine.handleAction(room, room.hostId, "report_result", { roundIdx: 0, matchIdx: 0, goalsA: 3, goalsB: 1 });
  assert.equal(res.handled, true);
  const match = room.round.rounds[0][0];
  assert.equal(match.winner, match.a);
  assert.equal(room.round.rounds[1][0].a, match.a);
});

test("report_result rejects a tie when tracking goals", () => {
  const room = makeRoom();
  assignAllTeams(room);
  engine.startRound(room);
  const res = engine.handleAction(room, room.hostId, "report_result", { roundIdx: 0, matchIdx: 0, goalsA: 2, goalsB: 2 });
  assert.equal(res.handled, false);
});

test("report_result rejects reporting an already-decided match", () => {
  const room = makeRoom();
  assignAllTeams(room);
  engine.startRound(room);
  engine.handleAction(room, room.hostId, "report_result", { roundIdx: 0, matchIdx: 0, goalsA: 2, goalsB: 1 });
  const res = engine.handleAction(room, room.hostId, "report_result", { roundIdx: 0, matchIdx: 0, goalsA: 5, goalsB: 0 });
  assert.equal(res.handled, false);
});

test("report_result without goal tracking uses winnerSide instead", () => {
  const room = makeRoom();
  room.config.trackGoals = false;
  assignAllTeams(room);
  engine.startRound(room);

  const match = room.round.rounds[0][0];
  const res = engine.handleAction(room, room.hostId, "report_result", { roundIdx: 0, matchIdx: 0, winnerSide: "b" });
  assert.equal(res.handled, true);
  assert.equal(match.winner, match.b);
});

test("deciding the final match crowns a champion", () => {
  const room = makeRoom({ players: makePlayers(2) });
  assignAllTeams(room);
  engine.startRound(room);
  engine.handleAction(room, room.hostId, "report_result", { roundIdx: 0, matchIdx: 0, goalsA: 1, goalsB: 0 });
  assert.equal(room.phase, "champion");
});

test("getPublicRoundView exposes the bracket", () => {
  const room = makeRoom();
  assignAllTeams(room);
  engine.startRound(room);
  const view = engine.getPublicRoundView(room);
  assert.deepEqual(view.rounds, room.round.rounds);
});

test("getPublicRoundView returns null before the bracket is built", () => {
  const room = makeRoom();
  assert.equal(engine.getPublicRoundView(room), null);
});
