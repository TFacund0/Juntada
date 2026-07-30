// Shared shapes for RoundView's (online) room.round/room.config — split out
// so each phase screen (RoundPhaseScreen, VotingPhaseScreen, etc.) can import
// them without redeclaring. Mirrors backend/src/games/impostor/engine.ts's
// getPublicRoundView.
export interface ImpostorRoundState {
  categoryLabel: string;
  categoryIcon: string;
  impostorCount: number;
  timerEnd: number | null;
  discussionEnd: number | null;
  turnOrder: string[];
  turnIndex: number;
  clues: Record<string, string>;
  votes: Record<string, string>;
  matchEliminated: string[];
  eliminated: string | null;
  wasImpostor?: boolean;
  tally?: Record<string, number>;
  impostors?: string[];
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  abortedReason?: "impostor_disconnected";
  votesDiscarded?: boolean;
  tieBrokenRandomly?: boolean;
  restartedReason?: "word_pool_exhausted";
  skipVotes: number;
  skipVoterIds: string[];
  skipVotesNeeded: number;
  rerollCount: number;
  revoteCandidates: string[] | null;
  revoteCount: number;
}

// Snapshot pushed onto room.roundHistory once a vote resolves (see engine.ts's
// tallyVotes/abortMatchImpostorLeft) — a different, smaller shape than the
// live public round view above since the round itself is gone by then.
export interface ImpostorHistoryEntry {
  word: string;
  categoryLabel: string;
  categoryIcon: string;
  impostors: string[];
  eliminated: string | null;
  wasImpostor?: boolean;
  tally: Record<string, number>;
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  abortedReason?: "impostor_disconnected";
  votesDiscarded?: boolean;
  tieBrokenRandomly?: boolean;
}

// Only the fields the UI actually reads, out of the full ImpostorConfig
// backend/src/games/impostor/engine.ts defines.
export interface ImpostorConfigState {
  writtenClues: boolean;
  hintsEnabled: boolean;
  clueTime: number;
  discussionTime: number;
  showCategory: boolean;
}
