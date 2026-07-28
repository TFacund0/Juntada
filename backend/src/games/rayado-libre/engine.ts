// ─── Rayado Libre Game Engine ────────────────────────────────────────────────
// Draw-and-guess: one player at a time draws a secret word on a shared board
// while everyone else types guesses in a chat. Turns rotate through every
// player, `totalRounds` times each (see createConfig).
//
// Phases: choosing (drawer picks 1 of 3 random words, auto-picked if they
// stall) -> drawing (99s countdown, strokes + guesses stream in) -> reveal
// ("the word was X" — no timer at all here, purely gated on every online
// player tapping "listo", see the "player_ready" action below) -> back to
// choosing for the next drawer, or -> result once every turn has been played.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

interface Category {
  label: string;
  icon: string;
  words: string[];
}

const {
  CATEGORIES,
  activeWordPool,
  pickThreeWords: pickThreeWordsFromPool,
} = require("@juntada/rayado-libre-data") as {
  CATEGORIES: Record<string, Category>;
  activeWordPool: (categories: Record<string, Category>, activeKeys: readonly string[]) => string[];
  pickThreeWords: (pool: readonly string[], usedWords: readonly string[]) => { words: string[]; resetUsed: boolean };
};
const { scoreForGuess, isCorrectGuess, TURN_SECONDS, DRAWER_POINTS_PER_GUESS, buildHintOrder, computeWordHint, popLastDrawUnit } =
  require("@juntada/rayado-libre-scoring") as {
    scoreForGuess: (secondsRemaining: number) => { points: number; jumpToSeconds: number | null };
    isCorrectGuess: (guess: string, word: string) => boolean;
    TURN_SECONDS: number;
    DRAWER_POINTS_PER_GUESS: number;
    buildHintOrder: (word: string) => number[];
    computeWordHint: (word: string, hintOrder: readonly number[], elapsedSeconds: number) => string;
    popLastDrawUnit: (strokes: readonly DrawAction[]) => DrawAction[];
  };
const { shuffle } = require("@juntada/core-utils");

const MIN_PLAYERS = 3;
const CHOOSE_SECONDS = 15;
// Bounds how much canvas history a single turn can accumulate — a legitimate
// drawing never gets close to this; it only guards against one very long
// turn (or a misbehaving client) growing the broadcast payload unbounded.
const MAX_STROKES = 3000;
// A real single mouse-move/touch-move stroke never gets close to this many
// points; it only guards against a malformed/malicious payload.points (huge
// array, or non-numeric entries) getting stored and rebroadcast verbatim to
// every other player's canvas — unlike every other draw_* field, this one
// wasn't shape-checked before.
const MAX_POINTS_PER_STROKE = 5000;

// Every other payload field here goes through String()/Number(), which
// coerce anything into a usable (if wrong) value — an array can't be
// coerced the same way, so a malformed payload.points needs its own check
// instead of just trusting the client's `as [number, number][]` cast.
function parseStrokePoints(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_POINTS_PER_STROKE) return null;
  const points: [number, number][] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length !== 2) return null;
    const [x, y] = p;
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push([x, y]);
  }
  return points;
}
// Kept generous enough that the reveal-phase recap ("cómo veníamos
// escribiendo") still shows a real conversation instead of just the last 5
// messages of the whole turn — the live "drawing" chat view is what trims
// that down to a short recent window, purely on the frontend side (see
// RoundView.tsx), so this same stored log serves both without needing two
// copies.
const CHAT_LOG_LIMIT = 30;

type DrawAction =
  | import("@juntada/rayado-libre-scoring").StrokeAction
  | import("@juntada/rayado-libre-scoring").FillAction
  | import("@juntada/rayado-libre-scoring").ClearAction;

interface ChatEntry {
  type: "chat" | "correct";
  playerId: string;
  text?: string;
}

interface RayadoLibreConfig {
  score: Record<string, number>;
  totalRounds: number;
  enabledCategories: Record<string, boolean>;
  [key: string]: unknown;
}

interface RayadoLibreRound {
  // Remaining drawer ids for the rest of the game — [0] is whoever's turn it
  // currently is (choosing/drawing/reveal); shifted off once their turn ends.
  turnQueue: string[];
  totalTurns: number;
  drawerId: string;
  wordChoices: string[] | null;
  word: string | null;
  chooseTimerEnd: number | null;
  timerEnd: number | null;
  // Set together the moment drawing starts — see computeWordHint. Kept apart
  // from timerEnd/scoring on purpose: timerEnd jumps forward on a correct
  // guess, but hints shouldn't suddenly cascade just because someone scored.
  drawingStartedAt: number | null;
  hintOrder: number[];
  strokes: DrawAction[];
  chatLog: ChatEntry[];
  correctGuessers: string[];
  // Points gained this specific turn only (guessers' scores plus the
  // drawer's per-guess bonus) — separate from the cumulative cfg(room).score
  // so the reveal screen can show "+N this turn" next to each player's
  // running total without the two ever needing to be reconciled by hand.
  roundPoints: Record<string, number>;
  // Bumped on every correct guess so the guesser's own client can diff it
  // (same pattern as impostor's rerollCount) to show a one-time "+N puntos"
  // toast instead of it reappearing on every unrelated private_role refresh.
  guessId: number;
  lastGuess: { playerId: string; points: number; guessId: number } | null;
}

function cfg(room: Room): RayadoLibreConfig {
  return room.config as RayadoLibreConfig;
}

function round(room: Room): RayadoLibreRound {
  return room.round as RayadoLibreRound;
}

// Backfills any RayadoLibreRound field that's missing on `room.round` — the
// only way that happens is a round persisted (Redis snapshot, or an
// in-memory room that outlived a hot-reload) from a server version older
// than whichever field was added most recently. Idempotent and cheap, so
// it's safe to call defensively on every entry point instead of trying to
// track down every place a stale round could first get touched.
function migrateRound(room: Room): void {
  if (!room.round) return;
  const r = round(room);
  if (r.hintOrder == null) r.hintOrder = r.word ? buildHintOrder(r.word) : [];
  if (r.drawingStartedAt == null && room.phase === "drawing") r.drawingStartedAt = Date.now();
  if (r.roundPoints == null) r.roundPoints = {};
  if (r.guessId == null) r.guessId = 0;
  if (r.lastGuess === undefined) r.lastGuess = null;
  if (r.chatLog == null) r.chatLog = [];
  if (r.correctGuessers == null) r.correctGuessers = [];
  if (r.strokes == null) r.strokes = [];
}

function createConfig(): RayadoLibreConfig {
  return {
    score: {},
    totalRounds: 3,
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {} as Record<string, boolean>),
  };
}

function activeCategoryKeys(room: Room): string[] {
  const enabled = cfg(room).enabledCategories;
  if (!enabled || typeof enabled !== "object") return [];
  return Object.keys(CATEGORIES).filter(k => enabled[k]);
}

// Offers 3 words at random from every active category combined (mixed
// together, not one category at a time) — avoiding words already used this
// game so a drawer never gets offered a repeat. Falls back to allowing
// repeats only once the whole active pool has been exhausted, rather than
// ever being unable to offer a 3rd option. The actual pool/pick algorithm
// lives in @juntada/rayado-libre-data so LocalGame's offline mode computes
// the exact same thing — this just adapts it to the server's Room shape.
function pickThreeWords(room: Room): string[] {
  const pool = activeWordPool(CATEGORIES, activeCategoryKeys(room));
  const used = (room.usedWords.words as string[] | undefined) ?? [];
  const { words, resetUsed } = pickThreeWordsFromPool(pool, used);
  if (resetUsed) room.usedWords.words = [];
  return words;
}

function startTurnChoosing(room: Room, drawerId: string): void {
  const r = round(room);
  r.drawerId = drawerId;
  r.wordChoices = pickThreeWords(room);
  r.word = null;
  r.chooseTimerEnd = Date.now() + CHOOSE_SECONDS * 1000;
  r.timerEnd = null;
  r.drawingStartedAt = null;
  r.hintOrder = [];
  r.strokes = [];
  r.chatLog = [];
  r.correctGuessers = [];
  r.roundPoints = {};
  r.lastGuess = null;
  room.phase = "choosing";
}

// Locks in the chosen word and starts the drawing timer + hint schedule —
// shared by the drawer's own choice (choose_word) and the auto-pick fallback
// when they stall (forceReadyAndAdvance), so the two can't drift apart.
function beginDrawing(room: Room, word: string): void {
  const r = round(room);
  r.word = word;
  r.wordChoices = null;
  r.chooseTimerEnd = null;
  r.timerEnd = Date.now() + TURN_SECONDS * 1000;
  r.drawingStartedAt = Date.now();
  r.hintOrder = buildHintOrder(word);
  room.phase = "drawing";
}

// Drawer's turn is over (timer ran out, or everyone online already guessed
// it) — show the word to everyone and wait for each player to confirm
// they're ready before moving on (see the "player_ready" action). No timer
// of its own — nothing auto-advances this phase, it's purely gated on
// everyone confirming (an offline player is excluded from that check, see
// maybeAdvance, so they can't stall the room by dropping mid-reveal).
function finishDrawingPhase(room: Room): void {
  const r = round(room);
  room.usedWords.words = [...((room.usedWords.words as string[] | undefined) ?? []), r.word as string];
  r.timerEnd = null;
  r.chooseTimerEnd = null;
  room.phase = "reveal";
  room.players.forEach(p => {
    p.ready = false;
  });
}

// Moves the queue past whoever's turn just ended and either starts the next
// drawer's "choosing" phase or, once the queue's empty, ends the game.
function advanceToNextTurn(room: Room): void {
  const r = round(room);
  r.turnQueue.shift();
  // A player who left the room entirely mid-game shouldn't still get a turn
  // later — drop them from the remaining queue (their earlier turns already
  // happened and stay counted).
  r.turnQueue = r.turnQueue.filter(id => room.players.some(p => p.id === id));
  if (r.turnQueue.length === 0) {
    room.phase = "result";
    return;
  }
  startTurnChoosing(room, r.turnQueue[0]);
}

// The drawer disconnecting for good (kicked, or the 5-minute auto-kick) mid-
// turn leaves nothing honest left to finish — nobody else can draw for them,
// so skip straight to the next turn instead of waiting out a timer that can
// never resolve normally.
function skipTurnIfDrawerGone(room: Room): boolean {
  const r = round(room);
  if (room.players.some(p => p.id === r.drawerId)) return false;
  advanceToNextTurn(room);
  return true;
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Necesitás al menos ${MIN_PLAYERS} jugadores` };
  if (activeCategoryKeys(room).length === 0) return { error: "No hay categorías activas" };

  const totalRounds = Number.isInteger(cfg(room).totalRounds) && cfg(room).totalRounds > 0 ? cfg(room).totalRounds : 3;
  const order = shuffle(room.players.map(p => p.id)) as string[];
  const turnQueue: string[] = [];
  for (let i = 0; i < totalRounds; i++) turnQueue.push(...order);

  room.round = {
    turnQueue,
    totalTurns: turnQueue.length,
    drawerId: "",
    wordChoices: null,
    word: null,
    chooseTimerEnd: null,
    timerEnd: null,
    drawingStartedAt: null,
    hintOrder: [],
    strokes: [],
    chatLog: [],
    correctGuessers: [],
    roundPoints: {},
    guessId: 0,
    lastGuess: null,
  } satisfies RayadoLibreRound;
  room.phase = "lobby"; // overwritten by startTurnChoosing below
  startTurnChoosing(room, turnQueue[0]);

  return { success: true };
}

function pushDrawAction(room: Room, action: DrawAction): void {
  const r = round(room);
  r.strokes.push(action);
  if (r.strokes.length > MAX_STROKES) r.strokes.shift();
}

function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  migrateRound(room);
  if (skipTurnIfDrawerGone(room)) return;
  const r = round(room);
  if (room.phase === "drawing") {
    const onlineGuessers = room.players.filter(p => p.online && p.id !== r.drawerId);
    if (onlineGuessers.length > 0 && onlineGuessers.every(p => r.correctGuessers.includes(p.id))) {
      finishDrawingPhase(room);
    }
    return;
  }
  if (room.phase === "reveal") {
    const online = room.players.filter(p => p.online);
    if (online.length > 0 && online.every(p => p.ready)) advanceToNextTurn(room);
  }
}

// Called once the drawer's been disconnected for about a minute straight
// (see ws/shared.ts's scheduleOfflineReaction — not the instant they drop,
// so a brief blip or answering a text doesn't cost them anything) and
// they're still offline. Without this, the turn would otherwise just sit
// there for however long is left on that phase's own timer (up to 99s) with
// nothing happening on the board — everyone else has no idea why. Skipping
// ahead at that point costs the drawer nothing more than forceReadyAndAdvance
// already would once their timer ran out anyway: auto-pick a word if they
// hadn't chosen yet, or end the drawing turn into reveal if they had.
function onPlayerOffline(room: Room, playerId: string): void {
  if (!room.round) return;
  migrateRound(room);
  const r = round(room);
  if (playerId !== r.drawerId) return;
  if (room.phase === "choosing" || room.phase === "drawing") forceReadyAndAdvance(room);
}

function forceReadyAndAdvance(room: Room): void {
  const r = round(room);
  if (room.phase === "choosing") {
    const word = r.wordChoices && r.wordChoices.length > 0 ? r.wordChoices[Math.floor(Math.random() * r.wordChoices.length)] : null;
    if (!word) {
      advanceToNextTurn(room);
      return;
    }
    beginDrawing(room, word);
    return;
  }
  if (room.phase === "drawing") {
    finishDrawingPhase(room);
  }
  // No case for "reveal" — it has no timer of its own (see finishDrawingPhase),
  // so the transport layer never schedules a call here for that phase.
}

function getPhaseTimerEnd(room: Room): number | null {
  if (!room.round) return null;
  const r = round(room);
  if (room.phase === "choosing") return r.chooseTimerEnd;
  if (room.phase === "drawing") return r.timerEnd;
  return null;
}

function resetProgress(room: Room): void {
  cfg(room).score = {};
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  if (!room.round) return { handled: false };
  migrateRound(room);
  const r = round(room);

  switch (action) {
    // Sends everyone back to the lobby so the host can reconfigure
    // (categories, rounds, ...) before the next match, and clears the
    // cumulative score — same as tutifruti/sintonia's own new_game. Without
    // this, cfg(room).score never resets on its own: startRound (the
    // "Nueva partida" path before this existed) only rebuilds turnQueue, so
    // points kept accumulating across every match played in the same room.
    case "new_game": {
      if (playerId !== room.hostId) return { handled: false };
      resetProgress(room);
      room.round = null;
      room.phase = "lobby";
      room.players.forEach(p => {
        p.ready = false;
      });
      return { handled: true };
    }

    case "choose_word": {
      if (room.phase !== "choosing" || playerId !== r.drawerId) return { handled: false };
      const word = String(payload.word ?? "");
      if (!r.wordChoices?.includes(word)) return { handled: false };
      beginDrawing(room, word);
      return { handled: true, rerolled: true };
    }

    case "draw_stroke": {
      if (room.phase !== "drawing" || playerId !== r.drawerId) return { handled: false };
      const points = parseStrokePoints(payload.points);
      if (!points) return { handled: false };
      pushDrawAction(room, {
        type: "stroke",
        points,
        color: String(payload.color),
        size: Number(payload.size),
        strokeId: Number(payload.strokeId),
      });
      return { handled: true };
    }

    case "draw_fill": {
      if (room.phase !== "drawing" || playerId !== r.drawerId) return { handled: false };
      const x = Number(payload.x);
      const y = Number(payload.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: false };
      pushDrawAction(room, { type: "fill", x, y, color: String(payload.color) });
      return { handled: true };
    }

    case "draw_clear": {
      if (room.phase !== "drawing" || playerId !== r.drawerId) return { handled: false };
      r.strokes = [];
      return { handled: true };
    }

    case "draw_undo": {
      if (room.phase !== "drawing" || playerId !== r.drawerId) return { handled: false };
      r.strokes = popLastDrawUnit(r.strokes);
      return { handled: true };
    }

    case "player_ready": {
      if (room.phase !== "reveal") return { handled: false };
      const p = room.players.find(p => p.id === playerId);
      if (!p) return { handled: false };
      p.ready = true;
      maybeAdvance(room);
      // Unconditionally true, not just when this specific call happened to
      // be the one that advanced the turn: maybeAdvance may have just moved
      // everyone into a fresh "choosing" phase with a brand new drawer, and
      // that drawer's wordChoices only ever go out via getPrivateView — the
      // generic gameAction wrapper only re-sends private info per player
      // when told to via this flag (see roomHandlers.ts). Skipping it here
      // was the bug: the new drawer's word choices never arrived, since a
      // plain broadcastState only pushes the public view.
      return { handled: true, rerolled: true };
    }

    case "guess": {
      if (room.phase !== "drawing" || playerId === r.drawerId) return { handled: false };
      if (r.correctGuessers.includes(playerId)) return { handled: false };
      const text = String(payload.text ?? "");
      if (!text || !r.word) return { handled: false };

      if (isCorrectGuess(text, r.word)) {
        // Math.floor, not ceil — rounding up would systematically nudge a
        // guess landing at e.g. 59.4s remaining into the 60+ flat-60 zone
        // instead of the exact-value zone, always in the guesser's favor
        // right at the boundary. Floor keeps it to "how many whole seconds
        // are actually left", matching what the Timer UI shows.
        const secondsRemaining = Math.max(0, Math.floor(((r.timerEnd as number) - Date.now()) / 1000));
        const { points, jumpToSeconds } = scoreForGuess(secondsRemaining);
        cfg(room).score[playerId] = (cfg(room).score[playerId] || 0) + points;
        cfg(room).score[r.drawerId] = (cfg(room).score[r.drawerId] || 0) + DRAWER_POINTS_PER_GUESS;
        r.roundPoints[playerId] = (r.roundPoints[playerId] || 0) + points;
        r.roundPoints[r.drawerId] = (r.roundPoints[r.drawerId] || 0) + DRAWER_POINTS_PER_GUESS;
        r.correctGuessers.push(playerId);
        r.guessId += 1;
        r.lastGuess = { playerId, points, guessId: r.guessId };
        r.chatLog = [...r.chatLog, { type: "correct" as const, playerId }].slice(-CHAT_LOG_LIMIT);
        if (jumpToSeconds != null) r.timerEnd = Date.now() + jumpToSeconds * 1000;

        const onlineGuessers = room.players.filter(p => p.online && p.id !== r.drawerId);
        if (onlineGuessers.length > 0 && onlineGuessers.every(p => r.correctGuessers.includes(p.id))) {
          finishDrawingPhase(room);
        }
        return { handled: true, rerolled: true };
      }

      r.chatLog = [...r.chatLog, { type: "chat" as const, playerId, text }].slice(-CHAT_LOG_LIMIT);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  migrateRound(room);
  const r = round(room);
  const turnNumber = r.totalTurns - r.turnQueue.length + 1;
  const base = { turnNumber, totalTurns: r.totalTurns, drawerId: r.drawerId };

  if (room.phase === "choosing") return { ...base, chooseTimerEnd: r.chooseTimerEnd };
  if (room.phase === "drawing") {
    const elapsedSeconds = r.drawingStartedAt ? (Date.now() - r.drawingStartedAt) / 1000 : 0;
    const wordHint = r.word ? computeWordHint(r.word, r.hintOrder, elapsedSeconds) : "";
    return {
      ...base,
      timerEnd: r.timerEnd,
      strokes: r.strokes,
      chatLog: r.chatLog,
      correctGuessers: r.correctGuessers,
      roundPoints: r.roundPoints,
      wordHint,
    };
  }
  if (room.phase === "reveal") {
    return { ...base, word: r.word, correctGuessers: r.correctGuessers, chatLog: r.chatLog, roundPoints: r.roundPoints };
  }
  if (room.phase === "result") return { ...base, word: r.word };
  return base;
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  migrateRound(room);
  const r = round(room);
  const isDrawer = playerId === r.drawerId;
  const view: Record<string, unknown> = { isDrawer };
  if (isDrawer && room.phase === "choosing") view.wordChoices = r.wordChoices;
  // The drawer needs their own word available at all times while drawing —
  // the public view only ever exposes the blanked-out wordHint (see
  // getPublicRoundView), so without this the drawer would have no way to
  // check what they're supposed to be drawing after picking it.
  if (isDrawer && room.phase === "drawing") view.word = r.word;
  if (r.lastGuess && r.lastGuess.playerId === playerId) view.lastGuess = r.lastGuess;
  return view;
}

const engine: GameEngine = {
  id: "rayado-libre",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  forceReadyAndAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getPhaseTimerEnd,
  migrateRound,
  onPlayerOffline,
  resetProgress,
};

module.exports = engine;
