// Color math shared between the backend engine (decides real scores), the
// frontend's local pass-and-play mode (mirrors the same scoring offline),
// and the online RoundView — a single source so target generation, hue/sat/
// light → hex conversion, and the score formula can never drift apart
// between the three.

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r0, g0, b0] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r0 + m) * 255), Math.round((g0 + m) * 255), Math.round((b0 + m) * 255)];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}

// h: 0-360, s/l: 0-100 — the ranges the picker sliders use directly.
export function hslToHex(h: number, s: number, l: number): string {
  return toHex(...hslToRgb(h, s / 100, l / 100));
}

export function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// How long the target color stays visible before it's hidden and guessing
// starts — shared by the backend engine (drives showEndsAt) and both
// frontend modes (drives their own Timer/setTimeout), so all three can never
// silently drift to different durations.
export const SHOW_SECONDS = 5;

// Keeps targets away from near-black/near-white, which are trivial to guess.
export function randomTargetColor(): string {
  const h = Math.floor(Math.random() * 360);
  const s = 55 + Math.random() * 35;
  const l = 35 + Math.random() * 30;
  return hslToHex(h, s, l);
}

// "redmean" weighted Euclidean distance — a cheap, well-known approximation
// of perceptual color difference (see https://www.compuphase.com/cmetric.htm).
// Plain unweighted RGB distance treats a red/blue mismatch and a red/green
// mismatch as equally "far", but the eye doesn't: green differences read as
// much more obvious than blue ones. Weighting each channel by how much red
// is in the pair (via rmean) corrects for that, so two colors that are
// actually hard to tell apart score closer together than raw Euclidean
// distance would give them credit for.
function redmeanDistance(a: [number, number, number], b: [number, number, number]): number {
  const [r1, g1, b1] = a;
  const [r2, g2, b2] = b;
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rmean / 256) * dr ** 2 + 4 * dg ** 2 + (2 + (255 - rmean) / 256) * db ** 2);
}

// Black vs. white is the worst case for this weighting (see redmeanDistance):
// maximizing any channel's diff forces rmean toward the middle, which is
// exactly what happens at the two extremes of the RGB cube.
const MAX_DISTANCE = redmeanDistance([0, 0, 0], [255, 255, 255]);

// Punishes distance quadratically instead of linearly — a straight 1:1
// falloff was too forgiving on clearly-wrong guesses: complementary hues
// like red vs. green or blue vs. yellow (very different colors, but neither
// one anywhere near black/white, the normalization's actual worst case)
// were still landing 4-6/10. Squaring the normalized distance keeps near-
// exact guesses close to a perfect score while making "recognizably the
// wrong color" cost much more, the same shape a squared-error metric has
// everywhere else it's used to grade closeness.
const SCORE_EXPONENT = 2;

// 10.00 = exact match, 0.00 = as far as two colors can be (black vs. white).
// Two decimals so "9.84 vs 9.85" is a meaningful difference instead of
// everything rounding to whole points — dialed.gg-style precision, just on
// a friendlier 0-10 "grade" scale rather than 0-100.
export function scoreGuess(target: string, guess: string): number {
  const distance = redmeanDistance(hexToRgb(target), hexToRgb(guess));
  const closeness = 1 - distance / MAX_DISTANCE;
  const score = 10 * Math.pow(Math.max(0, closeness), SCORE_EXPONENT);
  return Math.round(score * 100) / 100;
}

// ─── Online wire types ───────────────────────────────────────────────────
// The exact shape backend/src/games/color-correcto/engine.ts's
// getPublicRoundView/getPrivateView/getRevealMessage return, and what
// frontend/.../color-correcto/RoundView.tsx reads room.round/myRole/
// wordReveal as — one shared definition instead of two hand-mirrored copies
// that could silently drift apart on a field rename.
export interface ColorCorrectoRoundView {
  target?: string | null;
  showEndsAt?: number | null;
  guessEndsAt?: number | null;
  submittedCount?: number;
  guessersOnline?: number;
  guesses?: Record<string, string> | null;
  scores?: Record<string, number> | null;
  playMode?: "endless" | "rounds";
  roundLimit?: number;
  roundsPlayed?: number;
}

export interface ColorCorrectoPrivateRole {
  myGuess: string | null;
}

export interface ColorCorrectoReveal {
  target: string;
}
