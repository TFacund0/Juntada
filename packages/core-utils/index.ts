// Small, generic helpers shared across the app that aren't specific to any
// one game's rules — unlike the other packages/*, which each hold one
// game's own logic (@juntada/recamara-engine, etc). Kept separate from
// those so a change here can't be mistaken for a game-rule change.

// Fisher-Yates — used wherever something needs a fair random order (turn
// order, word pools, wheel entries, deck order). Was previously duplicated
// verbatim in backend/src/utils/shuffle.ts and frontend/src/utils/shuffle.ts;
// one copy here means a fix/change can't silently apply to only one side.
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
