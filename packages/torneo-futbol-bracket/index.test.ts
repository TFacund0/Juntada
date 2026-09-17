import { describe, expect, it } from "vitest";
import { buildBracket, nextPowerOf2, propagateByes, type Entrant, type Match } from "./index";

const entrant = (id: number): Entrant<number> => ({ id, name: `P${id}`, team: `T${id}` });

describe("nextPowerOf2", () => {
  it("rounds up to the next power of 2", () => {
    expect(nextPowerOf2(1)).toBe(1);
    expect(nextPowerOf2(3)).toBe(4);
    expect(nextPowerOf2(4)).toBe(4);
    expect(nextPowerOf2(5)).toBe(8);
  });
});

describe("buildBracket", () => {
  it("crowns a lone entrant champion by default", () => {
    const rounds = buildBracket([entrant(1)]);
    expect(rounds).toHaveLength(1);
    expect(rounds[0][0].winner?.id).toBe(1);
  });

  it("pairs every entrant with no byes on an exact power of 2", () => {
    const rounds = buildBracket([1, 2, 3, 4].map(entrant));
    expect(rounds[0]).toHaveLength(2);
    expect(rounds[0].every(m => m.a && m.b)).toBe(true);
    expect(rounds).toHaveLength(2);
  });

  it("gives byes only to trailing entrants, never pairing two byes together", () => {
    const rounds = buildBracket([1, 2, 3].map(entrant));
    expect(rounds[0]).toHaveLength(2);
    const byeMatches = rounds[0].filter(m => m.b === null);
    expect(byeMatches).toHaveLength(1);
    expect(byeMatches[0].winner).not.toBeNull();
  });

  it("propagates round-0 byes so round 1 always has two real contenders once played", () => {
    const rounds = buildBracket([1, 2, 3].map(entrant));
    const [round0, round1] = rounds;
    const playedMatch = round0.find(m => m.a && m.b)!;
    playedMatch.winner = playedMatch.a;
    propagateByes(rounds);
    expect(round1[0].a).not.toBeNull();
    expect(round1[0].b).not.toBeNull();
  });
});

describe("propagateByes", () => {
  it("does nothing when no match has a winner yet", () => {
    const rounds: Match<number>[][] = buildBracket([1, 2, 3, 4].map(entrant));
    rounds[0].forEach(m => (m.winner = null));
    propagateByes(rounds);
    expect(rounds[1][0].a).toBeNull();
    expect(rounds[1][0].b).toBeNull();
  });
});
