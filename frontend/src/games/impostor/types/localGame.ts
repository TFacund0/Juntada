// Shared shapes for LocalGame's own state — split out so each phase screen
// (SetupScreen, RevealScreen, etc.) can import them without redeclaring.
export interface LocalPlayer {
  id: number;
  name: string;
}

export interface Round {
  word: string;
  categoryKey: string;
  categoryLabel: string;
  // Fixed for the whole match — set once by startRound, carried over
  // unchanged by continueMatch across every subsequent vote.
  impostors: number[];
  // Cumulative across the whole match.
  matchEliminated: number[];
  // Whoever was still alive at the start of this round's vote.
  voters: number[];
  eliminated?: number;
  wasImpostor?: boolean;
  tally?: Record<number, number>;
  // voterId -> suspectId, so the result screen can show who voted for whom,
  // not just the totals.
  votesByVoter?: Record<number, number>;
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  // Set when the top vote count is tied — same idea as the online engine's
  // revoteCandidates/revoteCount (see @juntada/impostor-match-rules and
  // engine.ts's tallyVotes): repeat the vote among just the tied suspects
  // instead of eliminating one at random, up to MAX_REVOTES times.
  revoteCandidates?: number[];
  revoteCount: number;
}

export interface Config {
  numImpostors: number;
  hintsEnabled: boolean;
  writtenClues: boolean;
  discussionTime: number;
  discussionUnlimited: boolean;
  revealOnElimination: boolean;
  showCategory: boolean;
  enabledCategories: Record<string, boolean>;
}
