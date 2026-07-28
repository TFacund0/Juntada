// Shared shapes for the online round view's phase components (see
// components/) — one definition instead of every phase file redeclaring its
// own copy. Ids here are always room player ids (strings); the local mode's
// equivalents (packages/torneo-futbol-bracket's own Entrant<number>/Match
// <number>) are a separate generic type, not this one.

export interface Entrant {
  id: string;
  name: string;
  team: string;
}

export interface Match {
  a: Entrant | null;
  b: Entrant | null;
  winner: Entrant | null;
  goalsA: number | null;
  goalsB: number | null;
}

export const ROUND_NAMES = (totalRounds: number): string[] => {
  const names = ["Final", "Semifinal", "Cuartos de final", "Octavos de final", "Dieciseisavos de final"];
  return Array.from({ length: totalRounds }, (_, i) => names[totalRounds - 1 - i] || `Ronda ${i + 1}`);
};
