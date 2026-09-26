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

// Fases de sala de este juego, en un solo lugar: `phase` es `string` suelto
// en shared-types, así que un typo en un literal no fallaría al compilar.
const PHASE = {
  LOBBY: "lobby",
  CHOOSING: "choosing",
  DRAWING: "drawing",
  REVEAL: "reveal",
  RESULT: "result",
} as const;

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
const {
  scoreForGuess,
  isCorrectGuess,
  TURN_SECONDS,
  DRAWER_POINTS_PER_GUESS,
  buildHintOrder,
  computeWordHint,
  popLastDrawUnit,
  MIN_PLAYERS,
  isCloseGuess,
  TYPING_TTL_MS,
} = require("@juntada/rayado-libre-scoring") as {
  scoreForGuess: (secondsRemaining: number) => { points: number; jumpToSeconds: number | null };
  isCorrectGuess: (guess: string, word: string) => boolean;
  TURN_SECONDS: number;
  DRAWER_POINTS_PER_GUESS: number;
  buildHintOrder: (word: string) => number[];
  computeWordHint: (word: string, hintOrder: readonly number[], elapsedSeconds: number) => string;
  popLastDrawUnit: (strokes: readonly DrawAction[]) => DrawAction[];
  MIN_PLAYERS: number;
  isCloseGuess: (guess: string, word: string) => boolean;
  TYPING_TTL_MS: number;
};
const { shuffle } = require("@juntada/core-utils");
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
// The whole turn's chat is shown (live, scrollable, and again as the reveal
// recap), so this is sized for a real 99s conversation — still bounded,
// since the full log goes out on every state broadcast.
const CHAT_LOG_LIMIT = 100;

type DrawAction =
  | import("@juntada/rayado-libre-scoring").StrokeAction
  | import("@juntada/rayado-libre-scoring").FillAction
  | import("@juntada/rayado-libre-scoring").ClearAction;

interface ChatEntry {
  // Monotonic per game (see RayadoLibreRound.chatSeq) — what closeEntryIds
  // points at, and a stable React key on the client.
  id: number;
  type: "chat" | "correct";
  playerId: string;
  text?: string;
}

interface RayadoLibreConfig {
  score: Record<string, number>;
  totalRounds: number;
  enabledCategories: Record<string, boolean>;
  // Palabras propias del anfitrión, sumadas al pool de las categorías
  // activas (ver pickThreeWords) — inicializado acá (no `undefined`) porque
  // roomService.updateConfig solo acepta un patch para una key que ya
  // exista en room.config con el mismo `typeof`.
  customWords: string[];
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
  // playerId -> whole seconds left on the clock when they guessed it this
  // turn (the same value scoreForGuess got). Only shown on the reveal screen
  // ("adivinó con 57s"), so it never needs to go out while drawing.
  guessSeconds: Record<string, number>;
  // Bumped on every correct guess so the guesser's own client can diff it
  // (same pattern as impostor's rerollCount) to show a one-time "+N puntos"
  // toast instead of it reappearing on every unrelated private_role refresh.
  guessId: number;
  lastGuess: { playerId: string; points: number; guessId: number } | null;
  // Last ChatEntry.id handed out — never reset between turns, so an id is
  // never reused while a client might still hold the previous turn's log.
  chatSeq: number;
  // "Está escribiendo…": playerId -> timestamp the indicator expires at
  // (last "typing" ping + TYPING_TTL_MS). Expired entries are simply
  // filtered out of the public view — nothing needs a server timer.
  typingUntil: Record<string, number>;
  // playerId -> ids of their own wrong guesses that were "close" (see
  // isCloseGuess). Private: only ever sent to that same player (see
  // getPrivateView), so nobody else learns how near they were.
  closeEntryIds: Record<string, number[]>;
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
  if (r.drawingStartedAt == null && room.phase === PHASE.DRAWING) r.drawingStartedAt = Date.now();
  if (r.roundPoints == null) r.roundPoints = {};
  if (r.guessSeconds == null) r.guessSeconds = {};
  if (r.guessId == null) r.guessId = 0;
  if (r.lastGuess === undefined) r.lastGuess = null;
  if (r.chatLog == null) r.chatLog = [];
  if (r.correctGuessers == null) r.correctGuessers = [];
  if (r.strokes == null) r.strokes = [];
  // "Pedir otra palabra" was removed — drop its leftover flag from rounds
  // persisted by an older server so it never leaks back into a view.
  delete (r as Partial<RayadoLibreRound> & { rerollUsed?: unknown }).rerollUsed;
  if (r.typingUntil == null) r.typingUntil = {};
  if (r.closeEntryIds == null) r.closeEntryIds = {};
  if (r.chatSeq == null) r.chatSeq = 0;
  // Entries logged before chat ids existed get one now, in log order.
  for (const entry of r.chatLog) {
    if (typeof entry.id !== "number") entry.id = ++r.chatSeq;
  }
}

function createConfig(): RayadoLibreConfig {
  return {
    score: {},
    totalRounds: 3,
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {} as Record<string, boolean>),
    customWords: [],
  };
}

function activeCategoryKeys(room: Room): string[] {
  const enabled = cfg(room).enabledCategories;
  if (!enabled || typeof enabled !== "object") return [];
  return Object.keys(CATEGORIES).filter(k => enabled[k]);
}

function customWords(room: Room): string[] {
  const words = cfg(room).customWords;
  return Array.isArray(words) ? words : [];
}

// Offers 3 words at random from every active category combined (mixed
// together, not one category at a time) plus the host's own custom words —
// avoiding words already used this game so a drawer never gets offered a
// repeat. Falls back to allowing repeats only once the whole active pool has
// been exhausted, rather than ever being unable to offer a 3rd option. The
// actual pool/pick algorithm lives in @juntada/rayado-libre-data so
// LocalGame's offline mode computes the exact same thing — this just adapts
// it to the server's Room shape (and folds in customWords, which the
// package itself doesn't know about).
function pickThreeWords(room: Room): string[] {
  const pool = [...activeWordPool(CATEGORIES, activeCategoryKeys(room)), ...customWords(room)];
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
  r.guessSeconds = {};
  r.lastGuess = null;
  r.typingUntil = {};
  r.closeEntryIds = {};
  room.phase = PHASE.CHOOSING;
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
  room.phase = PHASE.DRAWING;
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
  room.phase = PHASE.REVEAL;
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
    room.phase = PHASE.RESULT;
    return;
  }
  startTurnChoosing(room, r.turnQueue[0]);
}

// The drawer disconnecting for good (kicked, or the 1-minute auto-kick) mid-
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
  if (activeCategoryKeys(room).length === 0 && customWords(room).length === 0) return { error: "No hay categorías activas" };

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
    guessSeconds: {},
    guessId: 0,
    lastGuess: null,
    chatSeq: 0,
    typingUntil: {},
    closeEntryIds: {},
  } satisfies RayadoLibreRound;
  room.phase = PHASE.LOBBY; // overwritten by startTurnChoosing below
  startTurnChoosing(room, turnQueue[0]);

  return { success: true };
}

function pushDrawAction(room: Room, action: DrawAction): void {
  const r = round(room);
  r.strokes.push(action);
  if (r.strokes.length > MAX_STROKES) r.strokes.shift();
}

// Appends to the chat log with the next id, keeping it to CHAT_LOG_LIMIT —
// and drops "close" marks pointing at entries that just fell off, so
// closeEntryIds can never outgrow the log itself.
function pushChatEntry(room: Room, entry: Omit<ChatEntry, "id">): ChatEntry {
  const r = round(room);
  const logged: ChatEntry = { ...entry, id: ++r.chatSeq };
  r.chatLog = [...r.chatLog, logged].slice(-CHAT_LOG_LIMIT);
  const oldestId = r.chatLog[0].id;
  for (const [playerId, ids] of Object.entries(r.closeEntryIds)) {
    if (ids.length > 0 && ids[0] < oldestId) r.closeEntryIds[playerId] = ids.filter(id => id >= oldestId);
  }
  return logged;
}

// Who can still guess right now: only mid-drawing, never the drawer, and
// never someone who already got it. Shared by "guess" and "typing".
function canGuess(room: Room, playerId: string): boolean {
  const r = round(room);
  return room.phase === PHASE.DRAWING && playerId !== r.drawerId && !r.correctGuessers.includes(playerId);
}

// Typing indicators still running, for the public view — the drawer and
// anyone who already guessed never show as typing, even with a ping in flight.
function activeTyping(room: Room): Record<string, number> {
  const r = round(room);
  const now = Date.now();
  return Object.fromEntries(Object.entries(r.typingUntil).filter(([playerId, until]) => until > now && canGuess(room, playerId)));
}

function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  migrateRound(room);
  if (skipTurnIfDrawerGone(room)) return;
  const r = round(room);
  if (room.phase === PHASE.DRAWING) {
    const onlineGuessers = room.players.filter(p => p.online && p.id !== r.drawerId);
    if (onlineGuessers.length > 0 && onlineGuessers.every(p => r.correctGuessers.includes(p.id))) {
      finishDrawingPhase(room);
    }
    return;
  }
  if (room.phase === PHASE.REVEAL) {
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
  if (room.phase === PHASE.CHOOSING || room.phase === PHASE.DRAWING) forceReadyAndAdvance(room);
}

function forceReadyAndAdvance(room: Room): void {
  const r = round(room);
  if (room.phase === PHASE.CHOOSING) {
    const word = r.wordChoices && r.wordChoices.length > 0 ? r.wordChoices[Math.floor(Math.random() * r.wordChoices.length)] : null;
    if (!word) {
      advanceToNextTurn(room);
      return;
    }
    beginDrawing(room, word);
    return;
  }
  if (room.phase === PHASE.DRAWING) {
    finishDrawingPhase(room);
  }
  // No case for "reveal" — it has no timer of its own (see finishDrawingPhase),
  // so the transport layer never schedules a call here for that phase.
}

function getPhaseTimerEnd(room: Room): number | null {
  if (!room.round) return null;
  const r = round(room);
  if (room.phase === PHASE.CHOOSING) return r.chooseTimerEnd;
  if (room.phase === PHASE.DRAWING) return r.timerEnd;
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
): { handled: boolean; rerolled?: boolean; unchanged?: boolean } {
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
      room.phase = PHASE.LOBBY;
      room.players.forEach(p => {
        p.ready = false;
      });
      return { handled: true };
    }

    case "choose_word": {
      if (room.phase !== PHASE.CHOOSING || playerId !== r.drawerId) return { handled: false };
      const word = String(payload.word ?? "");
      if (!r.wordChoices?.includes(word)) return { handled: false };
      beginDrawing(room, word);
      return { handled: true, rerolled: true };
    }

    case "draw_stroke": {
      if (playerId !== r.drawerId) return { handled: false };
      if (room.phase !== PHASE.DRAWING) return { handled: true, unchanged: true };
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
      if (playerId !== r.drawerId) return { handled: false };
      if (room.phase !== PHASE.DRAWING) return { handled: true, unchanged: true };
      const x = Number(payload.x);
      const y = Number(payload.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { handled: false };
      pushDrawAction(room, { type: "fill", x, y, color: String(payload.color) });
      return { handled: true };
    }

    case "draw_clear": {
      if (playerId !== r.drawerId) return { handled: false };
      if (room.phase !== PHASE.DRAWING) return { handled: true, unchanged: true };
      r.strokes = [];
      return { handled: true };
    }

    case "draw_undo": {
      if (playerId !== r.drawerId) return { handled: false };
      if (room.phase !== PHASE.DRAWING) return { handled: true, unchanged: true };
      r.strokes = popLastDrawUnit(r.strokes);
      return { handled: true };
    }

    case "player_ready": {
      if (room.phase !== PHASE.REVEAL) return { handled: false };
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

    // "Está escribiendo…" — a guesser's client pings this at most every
    // TYPING_SEND_INTERVAL_MS while typing. A ping that can't apply (the
    // turn just ended, they just guessed it) is a normal race, not an error.
    case "typing": {
      if (!canGuess(room, playerId)) return { handled: true, unchanged: true };
      r.typingUntil[playerId] = Date.now() + TYPING_TTL_MS;
      return { handled: true };
    }

    case "guess": {
      if (!canGuess(room, playerId)) return { handled: false };
      const text = String(payload.text ?? "");
      if (!text || !r.word) return { handled: false };
      // Sending the guess ends that bout of typing.
      delete r.typingUntil[playerId];

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
        r.guessSeconds[playerId] = secondsRemaining;
        r.correctGuessers.push(playerId);
        r.guessId += 1;
        r.lastGuess = { playerId, points, guessId: r.guessId };
        pushChatEntry(room, { type: "correct", playerId });
        if (jumpToSeconds != null) r.timerEnd = Date.now() + jumpToSeconds * 1000;

        const onlineGuessers = room.players.filter(p => p.online && p.id !== r.drawerId);
        if (onlineGuessers.length > 0 && onlineGuessers.every(p => r.correctGuessers.includes(p.id))) {
          finishDrawingPhase(room);
        }
        return { handled: true, rerolled: true };
      }

      const entry = pushChatEntry(room, { type: "chat", playerId, text });
      if (isCloseGuess(text, r.word)) {
        (r.closeEntryIds[playerId] ??= []).push(entry.id);
        // Their private view changed (a new close mark) — `rerolled` is what
        // makes gameAction re-send private_role, not just the public state.
        return { handled: true, rerolled: true };
      }
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

  if (room.phase === PHASE.CHOOSING) return { ...base, chooseTimerEnd: r.chooseTimerEnd };
  if (room.phase === PHASE.DRAWING) {
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
      typingUntil: activeTyping(room),
    };
  }
  if (room.phase === PHASE.REVEAL) {
    return {
      ...base,
      word: r.word,
      correctGuessers: r.correctGuessers,
      chatLog: r.chatLog,
      roundPoints: r.roundPoints,
      guessSeconds: r.guessSeconds,
    };
  }
  if (room.phase === PHASE.RESULT) return { ...base, word: r.word };
  return base;
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  migrateRound(room);
  const r = round(room);
  const isDrawer = playerId === r.drawerId;
  const view: Record<string, unknown> = { isDrawer };
  if (isDrawer && room.phase === PHASE.CHOOSING) view.wordChoices = r.wordChoices;
  // The drawer needs their own word available at all times while drawing —
  // the public view only ever exposes the blanked-out wordHint (see
  // getPublicRoundView), so without this the drawer would have no way to
  // check what they're supposed to be drawing after picking it.
  if (isDrawer && room.phase === PHASE.DRAWING) view.word = r.word;
  // Someone who already guessed it knows the word anyway — their locked
  // input says "¡Era PALABRA!". Kept apart from `word` (the drawer's) so no
  // drawer-only UI can ever pick it up for a guesser.
  if (room.phase === PHASE.DRAWING && r.correctGuessers.includes(playerId)) view.guessedWord = r.word;
  if (room.phase === PHASE.DRAWING || room.phase === PHASE.REVEAL) view.closeEntryIds = r.closeEntryIds[playerId] ?? [];
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
