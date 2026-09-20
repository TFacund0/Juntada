// Shared shapes for the online round view's phase components (see
// components/) — one definition instead of every phase file redeclaring
// its own copy.

export interface TutifrutiCategory {
  id: string;
  label: string;
  icon?: string;
}

export interface TutifrutiAnswerBreakdown {
  word: string;
  valid: boolean;
  wrongLetter: boolean;
  duplicate: boolean;
  points: number;
  ticks: number;
  crosses: number;
}

// Mirrors backend/src/games/tutifruti/engine.ts's getPublicRoundView — fields
// accumulate as the round moves through phases (setup adds the base fields,
// writing adds doneCount/bastaBy, review/result add answers/marks/etc.), so
// most of the phase-specific fields stay optional here.
export interface TutifrutiRoundState {
  letter: string;
  rerollsUsed: number;
  categories: TutifrutiCategory[];
  endMode: "timer" | "basta";
  timerEnd: number | null;
  isFinalRound: boolean;
  roundNumber: number;
  totalRounds: number;
  doneCount?: number;
  bastaBy?: string | null;
  answers?: Record<string, Record<string, string>>;
  marks?: Record<string, Record<string, Record<string, boolean>>>;
  reviewConfirmed?: Record<string, boolean>;
  reviewEnd?: number | null;
  pointsByPlayer?: Record<string, number> | null;
  breakdown?: Record<string, Record<string, TutifrutiAnswerBreakdown>> | null;
}

export interface TutifrutiPrivateRole {
  myAnswers: Record<string, string>;
}
