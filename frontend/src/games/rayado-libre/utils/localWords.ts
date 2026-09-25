import { CATEGORIES, activeWordPool, pickThreeWords as pickThreeWordsFromPool } from "@juntada/rayado-libre-data";

// Same pool/pick algorithm the backend engine uses (see
// @juntada/rayado-libre-data) — this just adapts it to LocalGame's plain
// ref-array bookkeeping instead of room.usedWords, so the two can't drift.
// `customWords` folds in the host's own words the same way the engine does
// (see engine.ts's own pickThreeWords), on top of the active categories.
export function pickLocalWords(activeCatKeys: string[], usedWordsRef: { current: string[] }, customWords: string[]): string[] {
  const pool = [...activeWordPool(CATEGORIES, activeCatKeys), ...customWords];
  const { words, resetUsed } = pickThreeWordsFromPool(pool, usedWordsRef.current);
  if (resetUsed) usedWordsRef.current = [];
  return words;
}
