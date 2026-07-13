// Scoring thresholds shared between the backend engine (decides real points),
// the frontend LocalGame (mirrors the same scoring offline), and the Dial's
// visual zones (must line up with the same thresholds so what a player sees
// on the dial matches what they actually score) — a single source avoids the
// three drifting apart.
export interface ScoreZone {
  spread: number;
  points: number;
}

export const SCORE_ZONES: ScoreZone[] = [
  { spread: 3, points: 4 },
  { spread: 8, points: 3 },
  { spread: 15, points: 2 },
];

export function scoreFor(diff: number): number {
  for (const zone of SCORE_ZONES) {
    if (diff <= zone.spread) return zone.points;
  }
  return 0;
}
