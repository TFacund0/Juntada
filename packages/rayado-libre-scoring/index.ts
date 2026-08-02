// ─── Rayado Libre Scoring ────────────────────────────────────────────────────
// Shared between the backend engine (real scoring) and LocalGame (the shared-
// screen + human-judge mode) so both compute identical points from identical
// timer readings — a single source avoids the two drifting apart, same
// reasoning as sintonia-scoring.
//
// The round's countdown starts at TURN_SECONDS and only ever "jumps" down at
// two fixed checkpoints, each triggered by the first correct guess to land in
// that zone (not by elapsed time alone):
//   Zone 1 (60-99s remaining): first correct guess scores a flat 60 points,
//     and the timer immediately jumps down to 60s remaining.
//   Zone 2 (31-59s remaining): first correct guess in this zone (whether it's
//     the very first guess of the turn, because zone 1 was skipped, or the
//     second guess after zone 1's jump) scores exactly the remaining seconds,
//     and the timer jumps down to 30s remaining.
//   Zone 3 (0-30s remaining): every correct guess from here on scores exactly
//     the remaining seconds, with no further jump — the timer just keeps
//     counting down normally.
// Because the zone is derived purely from the current timer reading (not
// from which guess number this is), no extra "did zone 1 already happen"
// flags are needed: once a jump lands the timer at 60 or 30, any later guess
// naturally reads a value in the next zone down.
import { shuffle } from "@juntada/core-utils";
import { normalizeWord } from "@juntada/tutifruti-words";

export const TURN_SECONDS = 99;
export const ZONE_1_FLOOR = 60;
export const ZONE_1_POINTS = 60;
export const ZONE_2_FLOOR = 31;
export const ZONE_2_JUMP_TO = 30;

// Fixed bonus the drawer earns per player who guesses their word correctly —
// independent of timing, so a drawer is rewarded just for a guessable drawing.
export const DRAWER_POINTS_PER_GUESS = 10;

export interface GuessScore {
  points: number;
  // Seconds remaining the turn's timer should be forced down to, or null if
  // this guess doesn't trigger a jump (zone 3, or already past a jump).
  jumpToSeconds: number | null;
}

export function scoreForGuess(secondsRemaining: number): GuessScore {
  const clamped = Math.max(0, secondsRemaining);
  if (clamped >= ZONE_1_FLOOR) return { points: ZONE_1_POINTS, jumpToSeconds: ZONE_1_FLOOR };
  if (clamped >= ZONE_2_FLOOR) return { points: clamped, jumpToSeconds: ZONE_2_JUMP_TO };
  return { points: clamped, jumpToSeconds: null };
}

// Case/accent/whitespace-insensitive comparison so "Camión", "camion " and
// "CAMIÓN" all count as the same guess — players shouldn't lose out on a
// technicality of typing. Reuses tutifruti-words's normalizeWord rather than
// a second hand-rolled copy, since it also correctly keeps "ñ" distinct from
// "n" (this word bank has words like "Araña"/"Piña"/"Montaña" where that
// distinction matters).
export const normalizeGuess = normalizeWord;

export function isCorrectGuess(guess: string, word: string): boolean {
  const g = normalizeGuess(guess);
  return g.length > 0 && g === normalizeGuess(word);
}

// ─── Progressive letter hints ────────────────────────────────────────────────
// The word's length is visible from the moment drawing starts (as blanks),
// and one extra letter — picked at random, not left-to-right — gets revealed
// every HINT_INTERVAL_SECONDS of elapsed drawing time, capped well short of
// giving the whole word away. Deliberately timed off a fixed
// `drawingStartedAt` rather than the scoring timer's own countdown, since
// that one jumps forward on a correct guess (see scoreForGuess) — hints
// shouldn't suddenly cascade just because someone scored.
export const HINT_INTERVAL_SECONDS = 20;

// Spaces (and only spaces — accented letters, numbers, hyphens all count as
// revealable) are always shown as-is; everything else can be hinted.
const REVEALABLE = /\S/;

// The order to reveal this word's letters in, generated once per turn right
// when the word is chosen — never sent to the client, only used server (or
// LocalGame) side to compute the currently-visible hint string.
//
// For a multi-word phrase ("Cepillo de dientes"), revealing letters in pure
// random order can burn early hints on a short filler word ("de") while the
// actual noun stays fully blank — the least useful letters showing up first.
// Instead, letters are grouped by the space-separated word they belong to,
// and whole groups are ordered longest-word-first (ties keep their original
// left-to-right order; letters within a group are still shuffled, so it's
// not simply left-to-right within each word). Since maxHintsFor caps the
// total reveals at under half the word's letters, a short filler word often
// never gets touched at all — which is fine, it's the least informative
// part of the phrase anyway.
export function buildHintOrder(word: string): number[] {
  const groups: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i <= word.length; i++) {
    const atEnd = i === word.length;
    if (!atEnd && REVEALABLE.test(word[i])) {
      current.push(i);
      continue;
    }
    if (current.length > 0) groups.push(current);
    current = [];
  }
  groups.sort((a, b) => b.length - a.length);
  return groups.flatMap(g => shuffle(g));
}

// Never reveals every letter automatically — capped at just under half of
// them, so there's always something left for the drawing itself to convey.
export function maxHintsFor(word: string): number {
  const revealableCount = [...word].filter(c => REVEALABLE.test(c)).length;
  return Math.max(0, Math.floor((revealableCount - 1) / 2));
}

// The word, with not-yet-revealed letters replaced by "_" — safe to send to
// every guesser regardless of elapsed time, since it never contains more
// than what that much time has actually earned.
export function computeWordHint(word: string, hintOrder: readonly number[], elapsedSeconds: number): string {
  const revealedCount = Math.min(maxHintsFor(word), Math.max(0, Math.floor(elapsedSeconds / HINT_INTERVAL_SECONDS)));
  const revealed = new Set(hintOrder.slice(0, revealedCount));
  return [...word].map((c, i) => (!REVEALABLE.test(c) ? c : revealed.has(i) ? c : "_")).join("");
}

// ─── Drawing actions ─────────────────────────────────────────────────────────
// Shared between the backend engine and the frontend Canvas so both agree on
// the wire/local shape of a turn's drawing history, instead of each side
// hand-rolling its own copy of the same three variants.
export interface StrokeAction {
  type: "stroke";
  points: [number, number][];
  color: string;
  size: number;
  // Groups the many small chunks one continuous pointer gesture gets split
  // into (see Canvas.tsx's periodic flush) so "undo" can remove a whole
  // stroke at once instead of just its last tiny fragment.
  strokeId: number;
}
export interface FillAction {
  type: "fill";
  x: number;
  y: number;
  color: string;
}
export interface ClearAction {
  type: "clear";
}
export type DrawAction = StrokeAction | FillAction | ClearAction;

// Removes the most recent "unit" the drawer did: a whole gesture's worth of
// stroke chunks (matched by strokeId), or a single fill/clear if that was
// the last thing done. Returns a new array (or the same one, unchanged, if
// there's nothing to undo).
export function popLastDrawUnit(strokes: readonly DrawAction[]): DrawAction[] {
  if (strokes.length === 0) return [...strokes];
  const last = strokes[strokes.length - 1];
  if (last.type !== "stroke") return strokes.slice(0, -1);
  let cut = strokes.length;
  while (cut > 0) {
    const action = strokes[cut - 1];
    if (action.type !== "stroke" || action.strokeId !== last.strokeId) break;
    cut--;
  }
  return strokes.slice(0, cut);
}
