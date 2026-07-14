// ─── Impostor Match Rules ────────────────────────────────────────────────────
// Pure win-condition math shared between the backend engine (decides the
// real match, backend/src/games/impostor/engine.ts) and the frontend's
// offline pass-and-play mode (frontend/src/games/impostor/LocalGame.tsx),
// which re-implements the same match end-to-end without a server. Keeping
// this in one place means a rule change (e.g. how many impostors a lobby
// size allows, or when a match ends) can't drift between the two.

// The most impostors a room/table of this size can start with while keeping
// them a strict minority — otherwise the match could already be at (or past)
// the impostors' win condition the moment a single innocent is eliminated.
export function maxImpostors(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

// The match ends the moment every impostor's been caught (innocents win) or
// the surviving impostors are at least as many as the surviving innocents
// (impostors win, since they can no longer be outvoted) — otherwise it's
// null and another round of clue-giving is needed. Generic over the id type
// since the backend uses uuid strings and local mode uses numeric ids.
export function matchWinner<T>(impostors: T[], matchEliminated: T[], totalPlayers: number): "innocents" | "impostors" | null {
  const aliveImpostorCount = impostors.filter(id => !matchEliminated.includes(id)).length;
  const aliveTotal = totalPlayers - matchEliminated.length;
  const aliveInnocentCount = aliveTotal - aliveImpostorCount;
  if (aliveImpostorCount === 0) return "innocents";
  if (aliveImpostorCount >= aliveInnocentCount) return "impostors";
  return null;
}
