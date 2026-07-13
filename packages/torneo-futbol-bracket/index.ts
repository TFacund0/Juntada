// Single-elimination bracket construction, shared between the backend engine
// (online rooms, string player ids) and the frontend LocalGame (single
// device, numeric ids) — the algorithm is identical for both, only the
// entrant id type differs, so it's generic over `Id` instead of being
// duplicated per side.

export interface Entrant<Id> {
  id: Id;
  name: string;
  team: string;
}

export interface Match<Id> {
  a: Entrant<Id> | null;
  b: Entrant<Id> | null;
  winner: Entrant<Id> | null;
  goalsA: number | null;
  goalsB: number | null;
}

export function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function emptyMatch<Id>(): Match<Id> {
  return { a: null, b: null, winner: null, goalsA: null, goalsB: null };
}

// Pushes an already-decided winner into the next round's slot. Does NOT
// invent new winners for the next round — with byes distributed one-per-pair
// (see buildBracket) every later-round match always ends up with two real
// contenders, even if one arrives instantly via a round-0 bye and the other
// only after a real match is played.
export function propagateByes<Id>(rounds: Match<Id>[][]): void {
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((match, i) => {
      if (match.winner) {
        const nextMatch = rounds[r + 1][Math.floor(i / 2)];
        if (i % 2 === 0) nextMatch.a = match.winner;
        else nextMatch.b = match.winner;
      }
    });
  }
}

// entrants: already in the desired crossing order (round 0 = consecutive
// pairs). Byes go only to the trailing entrants, each in its own pair
// against an empty slot — never two byes paired against each other, so no
// round-0 match is ever left with zero real players.
export function buildBracket<Id>(entrants: Entrant<Id>[]): Match<Id>[][] {
  const size = nextPowerOf2(entrants.length);
  const pairCount = size / 2;
  const byeCount = size - entrants.length;
  const normalPairs = pairCount - byeCount;

  const pool = [...entrants];
  const round0: Match<Id>[] = [];
  for (let i = 0; i < normalPairs; i++) {
    round0.push({ a: pool.shift() ?? null, b: pool.shift() ?? null, winner: null, goalsA: null, goalsB: null });
  }
  for (let i = 0; i < byeCount; i++) {
    const a = pool.shift() ?? null;
    round0.push({ a, b: null, winner: a, goalsA: null, goalsB: null });
  }

  const rounds: Match<Id>[][] = [round0];
  let count = round0.length;
  while (count > 1) {
    count = count / 2;
    rounds.push(Array.from({ length: count }, () => emptyMatch<Id>()));
  }
  propagateByes(rounds);
  return rounds;
}
