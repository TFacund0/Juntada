import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBracket, nextPowerOf2, propagateByes } from "@juntada/torneo-futbol-bracket";
import type { Entrant, Match } from "@juntada/torneo-futbol-bracket";

// Direct tests for the bracket module shared between the backend engine
// (string ids) and the frontend LocalGame (number ids) — exercised here with
// number ids since that's the trickier generic instantiation to get wrong.

function makeEntrants(n: number): Entrant<number>[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Player ${i + 1}`, team: `Team ${i + 1}` }));
}

test("nextPowerOf2 rounds up to the nearest power of 2", () => {
  assert.equal(nextPowerOf2(1), 1);
  assert.equal(nextPowerOf2(2), 2);
  assert.equal(nextPowerOf2(3), 4);
  assert.equal(nextPowerOf2(5), 8);
  assert.equal(nextPowerOf2(8), 8);
});

test("a power-of-2 entrant count produces only real-vs-real pairs, no byes", () => {
  const rounds = buildBracket(makeEntrants(4));
  assert.equal(rounds.length, 2); // semifinal + final
  assert.equal(rounds[0].length, 2);
  rounds[0].forEach(m => {
    assert.ok(m.a && m.b);
    assert.equal(m.winner, null);
  });
});

test("a non-power-of-2 entrant count gives byes only to the trailing entrants", () => {
  const rounds = buildBracket(makeEntrants(3));
  // size=4, byeCount=1: 1 normal pair, 1 bye pair for the 3rd entrant.
  assert.equal(rounds[0].length, 2);
  assert.deepEqual(rounds[0][0].a, { id: 1, name: "Player 1", team: "Team 1" });
  assert.deepEqual(rounds[0][0].b, { id: 2, name: "Player 2", team: "Team 2" });
  assert.equal(rounds[0][0].winner, null);
  assert.deepEqual(rounds[0][1].a, { id: 3, name: "Player 3", team: "Team 3" });
  assert.equal(rounds[0][1].b, null);
  assert.deepEqual(rounds[0][1].winner, { id: 3, name: "Player 3", team: "Team 3" });
});

test("a single entrant is crowned champion immediately, not left in an unresolved match", () => {
  const rounds = buildBracket(makeEntrants(1));
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].length, 1);
  assert.deepEqual(rounds[0][0].winner, { id: 1, name: "Player 1", team: "Team 1" });
  assert.equal(rounds[0][0].b, null);
});

test("byes propagate immediately into the next round's slot", () => {
  const rounds = buildBracket(makeEntrants(3));
  // The bye winner (entrant 3) should already sit in the final as side "b".
  assert.deepEqual(rounds[1][0].b, { id: 3, name: "Player 3", team: "Team 3" });
  assert.equal(rounds[1][0].a, null); // waiting on the real match's winner
});

test("propagateByes pushes a newly-decided winner forward without touching unrelated matches", () => {
  const rounds: Match<number>[][] = [
    [
      { a: { id: 1, name: "A", team: "T1" }, b: { id: 2, name: "B", team: "T2" }, winner: null, goalsA: null, goalsB: null },
      { a: { id: 3, name: "C", team: "T3" }, b: { id: 4, name: "D", team: "T4" }, winner: null, goalsA: null, goalsB: null },
    ],
    [{ a: null, b: null, winner: null, goalsA: null, goalsB: null }],
  ];
  rounds[0][0].winner = rounds[0][0].a;

  propagateByes(rounds);

  assert.deepEqual(rounds[1][0].a, { id: 1, name: "A", team: "T1" });
  assert.equal(rounds[1][0].b, null); // second semifinal still undecided
});
