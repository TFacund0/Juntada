// ─── ¿Quién Soy? — Game Engine ───────────────────────────────────────────────
// Every player gets a secret word/character that everyone else can see, but
// they can't. Two ways to pick it (see config.wordSource):
//   "categories" — the host's active word-bank categories, one distinct word
//                   dealt straight to each player.
//   "suggested"  — every player writes one word for EVERY other player (not
//                   just one), submitted together as a single batch. Once
//                   everyone's submitted, each target's received words go to
//                   a vote (everyone but the target picks their favorite) —
//                   except when there's only one word in (always true in a
//                   2-player room, since there's only one other player who
//                   could suggest for you), which just uses it directly,
//                   nothing to vote on. Once every target's word is decided
//                   this way, there's a brief "assign" phase showing the
//                   final words (see getPrivateView's wordsVisibleToMe — by
//                   this point nobody's blind to any word except their own,
//                   since everyone but the target saw the options while
//                   voting) before the host moves everyone into "playing".
//
// Once everyone has a word, play rotates by turn: on your turn you either
// ask a free-text question (the first other player to answer locks in a
// sí/no + optional comment, logged publicly) or attempt a guess (right away
// scored; wrong burns one of MAX_WRONG_GUESSES attempts) or concede. A
// player leaves the rotation the moment they solve, run out of attempts, or
// concede. Scoring is lap-based: everyone still in the queue advances
// through "laps" (one full pass of the players who were still active when
// that lap started) together, so two players solving in the same lap — even
// on different turns — tie for the same placement, per design: turn order is
// arbitrary, it shouldn't decide who "really" solved it first.
//
// Phases: suggest -> vote -> assign -> playing -> result (categories mode
// skips straight from lobby to assign — no suggest/vote, words are just
// dealt — but still passes through the same brief "assign" beat before
// playing, so everyone gets a moment to see the room's words). start_round
// always begins a fresh single match; score
// persists across matches until "new_game" resets it, same as Ta-Te-Ti's
// local scoreboard brought online.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";
import {
  CATEGORIES,
  computeMatchRanks,
  isCorrectGuess,
  MAX_WRONG_GUESSES,
  type GuessLogEntry,
  type QAEntry,
  type QAResponse,
  type QuienSoyPrivateRole,
  type QuienSoyResult,
  type QuienSoyReveal,
  type QuienSoyRoundView,
} from "@juntada/quien-soy-data";

const { shuffle } = require("@juntada/core-utils") as { shuffle: <T>(arr: readonly T[]) => T[] };

interface QuienSoyConfig {
  wordSource: "categories" | "suggested";
  activeCategories: Record<string, boolean>;
  score: Record<string, number>;
  // Host-picked turn order, by player id — empty means "shuffle it" (the
  // original behavior). Only ever a hint: beginPlaying reconciles it against
  // whoever's actually in the room right now (see its own comment).
  turnOrder: string[];
  [key: string]: unknown;
}

interface Suggestion {
  by: string;
  text: string;
}

interface QuienSoyRound {
  words: Record<string, string>;
  wrongGuesses: Record<string, number>;
  results: QuienSoyResult[];

  // "suggested" mode only
  suggestions: Record<string, Suggestion[]> | null;
  submittedBy: string[] | null;
  voteOrder: string[] | null;
  currentVoteTarget: string | null;
  votes: Record<string, number> | null;

  // "playing" phase
  turnQueue: string[];
  // Set once at beginPlaying and never mutated — turnQueue itself rotates
  // and drops players as they finish, which is right for deciding whose
  // turn it is but wrong for display: the turn circle should keep showing
  // everyone (in their original slot) so a solved/eliminated/conceded
  // player doesn't just vanish from it, see getPublicRoundView.
  turnOrder: string[];
  lapNumber: number;
  turnsThisLap: number;
  lapSize: number;
  pendingQuestion: { by: string; text: string; responses: Record<string, QAResponse> } | null;
  qaLog: QAEntry[];
  guessLog: GuessLogEntry[];
}

function cfg(room: Room): QuienSoyConfig {
  return room.config as QuienSoyConfig;
}

function round(room: Room): QuienSoyRound {
  return room.round as QuienSoyRound;
}

const MIN_PLAYERS = 2;

function createConfig(): QuienSoyConfig {
  return {
    wordSource: "categories",
    activeCategories: Object.keys(CATEGORIES).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>),
    score: {},
    turnOrder: [],
  };
}

function activeCategoryKeys(room: Room): string[] {
  return Object.entries(cfg(room).activeCategories)
    .filter(([, on]) => on)
    .map(([k]) => k);
}

// One distinct word per player, dealt straight from the pool — wraps around
// (repeats) only in the unlikely case the pool is smaller than the room.
function pickWordsForPlayers(room: Room): Record<string, string> {
  const pool = shuffle(activeCategoryKeys(room).flatMap(k => CATEGORIES[k]?.words ?? []));
  const words: Record<string, string> = {};
  room.players.forEach((p, i) => {
    words[p.id] = pool[i % pool.length];
  });
  return words;
}

// A handful of category words to fall back on for whoever nobody bothered
// to write a suggestion for — same pool "categories" mode deals from, just
// not guaranteed distinct from each other (rare enough not to matter).
function fallbackWords(count: number): string[] {
  if (count === 0) return [];
  const pool = shuffle(Object.values(CATEGORIES).flatMap(c => c.words));
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
}

// Called once every player has submitted (writing a word for each other
// player is optional per pair — see submitSuggestion — so by this point a
// target might have gotten a suggestion from everyone, from just one
// person, or from nobody at all). Nobody at all falls back to a random
// category word; exactly one just uses it directly — always the case in a
// 2-player room, since there's only one other player who could possibly
// suggest for you; more than one goes into the voting queue. Either way,
// once every target's word is decided this lands on "assign" instead of
// jumping straight to "playing" — see the phase list up top.
function finalizeSuggestions(room: Room): void {
  const r = round(room);
  const ids = room.players.map(p => p.id);
  const untargeted = ids.filter(id => (r.suggestions![id]?.length ?? 0) === 0);
  const fallback = fallbackWords(untargeted.length);
  untargeted.forEach((id, i) => {
    r.words[id] = fallback[i];
  });

  const needsVote: string[] = [];
  ids.forEach(id => {
    const options = r.suggestions![id];
    if (options.length === 1) r.words[id] = options[0].text;
    else if (options.length > 1) needsVote.push(id);
  });

  if (needsVote.length === 0) {
    room.phase = "assign";
    return;
  }
  r.voteOrder = needsVote;
  const first = r.voteOrder.shift()!;
  startVotingOn(room, first);
}

function baseRound(): Omit<QuienSoyRound, "suggestions" | "submittedBy" | "voteOrder" | "currentVoteTarget" | "votes" | "words"> {
  return {
    wrongGuesses: {},
    results: [],
    turnQueue: [],
    turnOrder: [],
    lapNumber: 1,
    turnsThisLap: 0,
    lapSize: 0,
    pendingQuestion: null,
    qaLog: [],
    guessLog: [],
  };
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  const c = cfg(room);

  if (c.wordSource === "categories") {
    if (activeCategoryKeys(room).length === 0) return { error: "No hay categorías activas" };
    room.round = {
      ...baseRound(),
      words: pickWordsForPlayers(room),
      suggestions: null,
      submittedBy: null,
      voteOrder: null,
      currentVoteTarget: null,
      votes: null,
    } satisfies QuienSoyRound;
    // Same brief "assign" beat as suggested mode (see confirmWordsReady) —
    // every word is already decided at this point, so this is purely to give
    // everyone a moment to see the room's words before questions start,
    // instead of jumping straight into "playing" with them tucked away in a
    // collapsed accordion.
    room.phase = "assign";
    return { success: true };
  }

  const suggestions: Record<string, Suggestion[]> = {};
  room.players.forEach(p => {
    suggestions[p.id] = [];
  });
  room.round = {
    ...baseRound(),
    words: {},
    suggestions,
    submittedBy: [],
    voteOrder: null,
    currentVoteTarget: null,
    votes: null,
  } satisfies QuienSoyRound;
  room.phase = "suggest";
  return { success: true };
}

// A host-picked order is only ever a hint — reconcile it against who's
// actually in the room right now: drop anyone who left since it was set,
// then append anyone new (who joined after) in room-list order at the end,
// so a stale/partial order never silently drops a player from the rotation.
// No custom order (or nothing usable left of it) falls back to a shuffle,
// same as always.
function resolveTurnOrder(room: Room): string[] {
  const custom = cfg(room).turnOrder;
  const currentIds = room.players.map(p => p.id);
  if (!Array.isArray(custom) || custom.length === 0) return shuffle(currentIds);
  const kept = custom.filter(id => currentIds.includes(id));
  const missing = currentIds.filter(id => !kept.includes(id));
  return [...kept, ...missing];
}

function beginPlaying(room: Room): void {
  const r = round(room);
  r.turnQueue = resolveTurnOrder(room);
  r.turnOrder = r.turnQueue.slice();
  r.lapNumber = 1;
  r.turnsThisLap = 0;
  r.lapSize = r.turnQueue.length;
  room.phase = "playing";
}

function startVotingOn(room: Room, targetId: string): void {
  const r = round(room);
  r.currentVoteTarget = targetId;
  r.votes = {};
  room.phase = "vote";
}

// A word for each other player in the room, submitted together — but
// writing one for any given player is optional (blank/omitted entries are
// just skipped), not everyone has to have an opinion on everyone. The only
// hard requirement is collective, not per-submitter: every target ends up
// with at least one suggestion once all players have submitted — see
// finalizeSuggestions' fallback for whoever nobody wrote anything for.
// Always rerolled: this always flips the submitter's own private
// mySuggestionSubmitted flag (see getPrivateView), and once everyone's in,
// finalizeSuggestions also reassigns r.words/starts voting for everyone —
// without resending private info here, players would only see any of that
// on their own next action (or a manual refresh).
function submitSuggestion(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: true } {
  if (!room.round || room.phase !== "suggest") return { handled: false };
  const r = round(room);
  if (r.submittedBy!.includes(playerId)) return { handled: false };
  const raw = payload?.suggestions;
  if (!raw || typeof raw !== "object") return { handled: false };
  const others = room.players.filter(p => p.id !== playerId).map(p => p.id);
  others.forEach(id => {
    const text = String((raw as Record<string, unknown>)[id] ?? "").trim();
    if (text) r.suggestions![id].push({ by: playerId, text });
  });
  r.submittedBy!.push(playerId);

  if (r.submittedBy!.length >= room.players.length) finalizeSuggestions(room);
  return { handled: true, rerolled: true };
}

function tallySuggestionVotes(room: Room): void {
  const r = round(room);
  const targetId = r.currentVoteTarget!;
  const options = r.suggestions![targetId];
  const tally = options.map(() => 0);
  Object.values(r.votes!).forEach(idx => {
    if (tally[idx] != null) tally[idx] += 1;
  });
  const maxVotes = Math.max(...tally);
  const topIndices = tally.map((v, i) => (v === maxVotes ? i : -1)).filter(i => i >= 0);
  const winningIndex = topIndices[Math.floor(Math.random() * topIndices.length)];
  r.words[targetId] = options[winningIndex]?.text ?? "?";

  if (r.voteOrder!.length === 0) {
    room.phase = "assign";
    return;
  }
  const next = r.voteOrder!.shift()!;
  startVotingOn(room, next);
}

// Host-only: moves on from "assign" (words all decided, briefly shown)
// into "playing" once everyone's ready to start asking questions.
function confirmWordsReady(room: Room, playerId: string): { handled: boolean } {
  if (playerId !== room.hostId) return { handled: false };
  if (!room.round || room.phase !== "assign") return { handled: false };
  beginPlaying(room);
  return { handled: true };
}

// Always rerolled: this always flips the voter's own private myVote, and
// once everyone eligible has voted, tallySuggestionVotes also moves
// currentVoteTarget on to the next target (or into "assign") for everyone —
// each of which needs a fresh voteSuggestions/wordsVisibleToMe push, not
// just whatever the next actor happens to trigger themselves.
function voteSuggestion(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: true } {
  if (!room.round || room.phase !== "vote") return { handled: false };
  const r = round(room);
  if (playerId === r.currentVoteTarget) return { handled: false }; // can't vote on your own word
  if (r.votes![playerId] != null) return { handled: false };
  const idx = payload?.suggestionIndex;
  if (!Number.isInteger(idx) || (idx as number) < 0 || (idx as number) >= r.suggestions![r.currentVoteTarget!].length) {
    return { handled: false };
  }
  r.votes![playerId] = idx as number;

  const eligibleVoters = room.players.filter(p => p.id !== r.currentVoteTarget);
  if (eligibleVoters.every(p => r.votes![p.id] != null)) tallySuggestionVotes(room);
  return { handled: true, rerolled: true };
}

// Moves the current turn holder off the front of the queue — rotated to the
// back if they're still in the running, dropped entirely if they just
// solved/were eliminated/conceded — and updates lap bookkeeping so ties
// within the same lap can be detected later.
function finishTurn(room: Room, stillActive: boolean): void {
  const r = round(room);
  const id = r.turnQueue.shift();
  if (stillActive && id) r.turnQueue.push(id);
  r.turnsThisLap += 1;

  if (r.turnQueue.length === 0) {
    finalizeResults(room);
    room.phase = "result";
    return;
  }
  if (r.turnsThisLap >= r.lapSize) {
    r.lapNumber += 1;
    r.turnsThisLap = 0;
    r.lapSize = r.turnQueue.length;
  }
}

// Applies the shared computeMatchRanks (also used client-side purely for
// display — see packages/quien-soy-data) to the persistent score, the one
// place that ranking algorithm's output actually matters beyond a screen.
function finalizeResults(room: Room): void {
  const r = round(room);
  const ranks = computeMatchRanks(r.results, room.players.length);
  Object.entries(ranks).forEach(([playerId, { points }]) => {
    cfg(room).score[playerId] = (cfg(room).score[playerId] || 0) + points;
  });
}

function askQuestion(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean } {
  if (!room.round || room.phase !== "playing") return { handled: false };
  const r = round(room);
  if (r.turnQueue[0] !== playerId) return { handled: false };
  if (r.pendingQuestion) return { handled: false };
  const text = String(payload?.text || "").trim();
  if (!text) return { handled: false };
  r.pendingQuestion = { by: playerId, text, responses: {} };
  return { handled: true };
}

// Only online players (besides the asker) are owed a response — someone who
// disconnects mid-question shouldn't stall the turn forever waiting on an
// answer that may never come (same reasoning as rayado-libre's onlineGuessers).
function pendingQuestionSettled(room: Room, pending: { by: string; responses: Record<string, QAResponse> }): boolean {
  return room.players.filter(p => p.online && p.id !== pending.by).every(p => pending.responses[p.id]);
}

// Everyone but the asker gets a say on a pending question — answering "sí"
// or "no" or explicitly passing ("skip", for whoever doesn't want to write
// anything) — and the turn only moves on once every one of them has
// responded one way or another. That's what lets the asker later review
// every answer they got (see qaLog), instead of just whoever happened to
// reply first winning the only slot.
function answerQuestion(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean } {
  if (!room.round || room.phase !== "playing") return { handled: false };
  const r = round(room);
  if (!r.pendingQuestion || r.pendingQuestion.by === playerId) return { handled: false };
  if (r.pendingQuestion.responses[playerId]) return { handled: false };
  const answer = payload?.answer === "si" || payload?.answer === "no" || payload?.answer === "skip" ? payload.answer : null;
  if (!answer) return { handled: false };
  // A comment is allowed even alongside "paso" — someone might not want to
  // commit to sí/no but still have something worth telling the asker.
  const comment = String(payload?.comment || "").trim() || null;

  r.pendingQuestion.responses[playerId] = { answer, comment };

  if (!pendingQuestionSettled(room, r.pendingQuestion)) return { handled: true };

  r.qaLog.push({ turnPlayerId: r.pendingQuestion.by, question: r.pendingQuestion.text, responses: r.pendingQuestion.responses });
  r.pendingQuestion = null;
  finishTurn(room, true);
  return { handled: true };
}

// Always rerolled: a guess always changes the guesser's own private state —
// myWrongGuesses on a miss, or myWord/myOutcome once solved/eliminated —
// none of which is part of the public round view, so without resending
// private info here the guesser wouldn't see their own updated attempt count
// or revealed word until their next action or a manual refresh.
function submitGuess(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: true } {
  if (!room.round || room.phase !== "playing") return { handled: false };
  const r = round(room);
  if (r.turnQueue[0] !== playerId || r.pendingQuestion) return { handled: false };
  const text = String(payload?.text || "").trim();
  if (!text) return { handled: false };

  const correct = isCorrectGuess(text, r.words[playerId]);
  r.guessLog.push({ playerId, text, correct });

  if (correct) {
    r.results.push({ playerId, outcome: "solved", lap: r.lapNumber });
    finishTurn(room, false);
    return { handled: true, rerolled: true };
  }

  r.wrongGuesses[playerId] = (r.wrongGuesses[playerId] || 0) + 1;
  if (r.wrongGuesses[playerId] >= MAX_WRONG_GUESSES) {
    r.results.push({ playerId, outcome: "eliminated", lap: r.lapNumber });
    finishTurn(room, false);
  } else {
    finishTurn(room, true);
  }
  return { handled: true, rerolled: true };
}

// Always rerolled: conceding immediately reveals the player's own word via
// getPrivateView's myOutcome/myWord — without resending private info, the
// conceding player wouldn't see what their word was until something else
// happened to refresh it.
function concede(room: Room, playerId: string): { handled: boolean; rerolled?: true } {
  if (!room.round || room.phase !== "playing") return { handled: false };
  const r = round(room);
  // Same guard as submitGuess: with a question still pending, this player's
  // turn hasn't actually ended yet (answerQuestion is what calls finishTurn
  // once every response is in) — without it, conceding here orphaned
  // r.pendingQuestion pointing at a turn that finishTurn had already moved
  // past, so the next answerQuestion to settle it called finishTurn a
  // second time on whoever's turn it legitimately was by then, skipping
  // them entirely.
  if (r.turnQueue[0] !== playerId || r.pendingQuestion) return { handled: false };
  r.results.push({ playerId, outcome: "conceded", lap: r.lapNumber });
  finishTurn(room, false);
  return { handled: true, rerolled: true };
}

// Kicking (or auto-kicking an offline) player calls this right away — see
// roomHandlers.ts's kickPlayer/schedulePlayerKick — same as any disconnect
// that resolves a pending question. Before this, "suggest"/"vote" were
// missing entirely: getting kicked mid-suggest (or mid-vote) never
// re-checked whether the remaining players had already collectively
// satisfied that phase, so the room could get stuck waiting forever on a
// count that included someone no longer in it.
function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  const r = round(room);

  if (room.phase === "suggest") {
    if ((r.submittedBy?.length ?? 0) >= room.players.length) finalizeSuggestions(room);
    return;
  }

  if (room.phase === "vote") {
    if (!r.currentVoteTarget) return;
    // The word being voted on belonged to a player who's since left — there's
    // nothing left to decide here, move straight on to the next target (or
    // "assign" if that was the last one).
    if (!room.players.some(p => p.id === r.currentVoteTarget)) {
      if (r.voteOrder!.length === 0) {
        room.phase = "assign";
        return;
      }
      startVotingOn(room, r.voteOrder!.shift()!);
      return;
    }
    const eligibleVoters = room.players.filter(p => p.id !== r.currentVoteTarget);
    if (eligibleVoters.length > 0 && eligibleVoters.every(p => r.votes![p.id] != null)) tallySuggestionVotes(room);
    return;
  }

  if (room.phase !== "playing") return;
  // A player who left the room entirely mid-game shouldn't keep holding up
  // the rotation — drop them from the queue (their turn just never happens).
  const before = r.turnQueue.length;
  r.turnQueue = r.turnQueue.filter(id => room.players.some(p => p.id === id));
  if (r.turnQueue.length !== before && r.turnQueue.length === 0) {
    finalizeResults(room);
    room.phase = "result";
    return;
  }
  // Someone going offline mid-question shouldn't leave the asker stuck
  // waiting on a response that may never come — settle it with whatever
  // responses already came in from whoever's still online.
  if (r.pendingQuestion && pendingQuestionSettled(room, r.pendingQuestion)) {
    r.qaLog.push({ turnPlayerId: r.pendingQuestion.by, question: r.pendingQuestion.text, responses: r.pendingQuestion.responses });
    r.pendingQuestion = null;
    finishTurn(room, true);
  }
}

function resetProgress(room: Room): void {
  cfg(room).score = {};
}

function newGame(room: Room, playerId: string): { handled: boolean } {
  if (playerId !== room.hostId) return { handled: false };
  resetProgress(room);
  room.round = null;
  room.phase = "lobby";
  room.players.forEach(p => {
    p.ready = false;
  });
  return { handled: true };
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  switch (action) {
    case "new_game":
      return newGame(room, playerId);
    case "submit_suggestion":
      return submitSuggestion(room, playerId, payload);
    case "vote_suggestion":
      return voteSuggestion(room, playerId, payload);
    case "confirm_words_ready":
      return confirmWordsReady(room, playerId);
    case "ask_question":
      return askQuestion(room, playerId, payload);
    case "answer_question":
      return answerQuestion(room, playerId, payload);
    // Reuses the wire-level "guess" action (shared with rayado-libre's
    // {text} guesses) instead of "submit_guess", whose payload shape is
    // already pinned to Sintonía/Color Correcto's numeric-or-hex value —
    // see shared-types's SCHEMAS.
    case "guess":
      return submitGuess(room, playerId, payload);
    case "concede":
      return concede(room, playerId);
    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): QuienSoyRoundView | null {
  const c = cfg(room);
  if (!room.round) return { wordSource: c.wordSource };
  const r = round(room);

  return {
    wordSource: c.wordSource,
    // "suggest"
    submittedCount: r.submittedBy?.length ?? null,
    // "vote"
    currentVoteTarget: r.currentVoteTarget,
    voteSubmittedCount: r.votes ? Object.keys(r.votes).length : null,
    voteEligibleCount: r.currentVoteTarget ? room.players.length - 1 : null,
    // "playing" — currentTurnPlayerId comes from the live (shrinking,
    // rotating) turnQueue, but turnOrder shown to players is the stable
    // snapshot from when the round started, so a solved/eliminated/conceded
    // player stays visible in their original slot instead of disappearing
    // (see results for their outcome).
    currentTurnPlayerId: r.turnQueue[0] ?? null,
    turnOrder: r.turnOrder,
    lapNumber: r.lapNumber,
    pendingQuestion: r.pendingQuestion,
    qaLog: r.qaLog,
    guessLog: r.guessLog,
    wrongGuesses: r.wrongGuesses,
    // "result"
    results: r.results,
    words: room.phase === "result" ? r.words : null,
  };
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  const wordsVisibleToMe = Object.fromEntries(Object.entries(r.words).filter(([id]) => id !== playerId));

  const voteSuggestions =
    room.phase === "vote" && r.currentVoteTarget && playerId !== r.currentVoteTarget
      ? r.suggestions![r.currentVoteTarget].map(s => s.text)
      : null;

  // Once a player is out of the round (solved/eliminated/conceded) there's
  // no more strategy to protect — showing their own word satisfies the
  // "so what was it?" curiosity instead of making them wait for the shared
  // reveal once *everyone* finishes.
  const myOutcome = r.results.find(res => res.playerId === playerId)?.outcome ?? null;

  return {
    wordsVisibleToMe,
    myWrongGuesses: r.wrongGuesses[playerId] ?? 0,
    mySuggestionSubmitted: r.submittedBy?.includes(playerId) ?? false,
    voteSuggestions,
    myVote: r.votes?.[playerId] ?? null,
    myWord: myOutcome ? r.words[playerId] : null,
  } satisfies QuienSoyPrivateRole;
}

function getRevealMessage(room: Room): ({ type: string } & Record<string, unknown>) | null {
  if (!room.round) return null;
  return { type: "word_reveal", words: round(room).words } satisfies { type: string } & QuienSoyReveal;
}

const engine: GameEngine = {
  id: "quien-soy",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
  resetProgress,
};

module.exports = engine;
