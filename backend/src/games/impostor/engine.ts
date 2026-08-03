// ─── Impostor Game Engine ────────────────────────────────────────────────────
// Implements the game-engine contract described in src/games/registry.js
// (and typed as GameEngine in ../engineTypes.ts). Owns everything specific to
// "who is the impostor": categories, word assignment, clues, voting and the
// impostor reveal. Knows nothing about WebSocket transport or generic
// room/player bookkeeping.
//
// Phases: round (see word, then take turns giving a one-word clue in the
// configured order — writing it if writtenClues is on, or just confirming
// out loud otherwise) -> discussion (think, no new info; skippable early if
// everyone's ready) -> voting -> result. discussionTime = 0 skips the
// discussion phase entirely.
//
// A "match" spans multiple votes: startRound begins a fresh match (new
// impostors, empty elimination list); each vote eliminates someone but only
// ends the match once every impostor is caught (innocents win) or the
// surviving impostors are at least as many as the surviving innocents
// (impostors win) — see tallyVotes. Until then, continueMatch starts another
// round of clue-giving among whoever's still alive, keeping the same
// impostors and eliminated list.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

interface Category {
  label: string;
  icon: string;
  words: string[];
  hints: Record<string, string>;
}

const { CATEGORIES, wordHint } = require("@juntada/impostor-data") as {
  CATEGORIES: Record<string, Category>;
  wordHint: (catKey: string, word: string) => string | null;
};
const { shuffle } = require("@juntada/core-utils");
const { timers } = require("../../state/roomStore") as { timers: Map<string, NodeJS.Timeout> };

interface ImpostorConfig {
  enabledCategories: Record<string, boolean>;
  numImpostors: number;
  hintsEnabled: boolean;
  clueTime: number;
  writtenClues: boolean;
  discussionTime: number;
  discussionUnlimited: boolean;
  // How the table discusses once clues are in: out loud ("voice", the
  // default — everyone's talking in person/on a call, nothing for the app
  // to do) or through a text chat rendered right in the discussion phase
  // ("chat" — see round.chat below and send_chat_message).
  discussionMode: "voice" | "chat";
  // Preferred speaking order (player ids), edited host-side in
  // ConfigPanel.tsx. Applied loosely at round start — see effectiveTurnOrder.
  turnOrder: string[];
  // Whether eliminating someone tells the table if they were the impostor,
  // or just that they're out — the full impostor roster only ever comes out
  // once the match itself ends, regardless of this setting.
  revealOnElimination: boolean;
  // Shows the round's category above the word/hint on everyone's card once
  // revealed — innocents and the impostor alike (see RoundView.tsx).
  showCategory: boolean;
  // Bumped every time a round starts (a fresh match via startRound, or
  // another lap within one via continueMatch) — see effectiveTurnOrder. Not
  // host-editable; keeps the same player from always going first.
  turnRotation: number;
  [key: string]: unknown;
}

interface ImpostorRound {
  word: string;
  categoryKey: string;
  categoryLabel: string;
  categoryIcon: string;
  // Fixed for the whole match — set once by startRound, carried over
  // unchanged by continueMatch across every subsequent vote.
  impostors: string[];
  // Cumulative across the whole match (see matchEliminated below).
  clues: Record<string, string>;
  // This round's actual speaking order and whose turn it currently is —
  // computed at the start of each round (see effectiveTurnOrder), limited to
  // players still alive, so a mid-round config edit can't shift it under
  // everyone's feet.
  turnOrder: string[];
  turnIndex: number;
  votes: Record<string, string>;
  skipVotes: string[];
  // Bumped every time skip_word actually swaps the word (see rerollWord) —
  // the frontend diffs this to show a short "cambiando de palabra" transition
  // instead of the new word just appearing instantly.
  rerollCount: number;
  // Everyone eliminated so far this match (across every vote), oldest first.
  matchEliminated: string[];
  eliminated: string | null; // who this specific vote eliminated
  revealed: boolean; // whether `wasImpostor` below should be shown for that
  wasImpostor?: boolean;
  matchOver: boolean;
  winner: "innocents" | "impostors" | null;
  timerEnd: number | null;
  discussionEnd: number | null;
  revoteCandidates: string[] | null;
  revoteCount: number;
  tally?: Record<string, number>;
  // Discussion-phase text chat (only populated/used when discussionMode is
  // "chat") — kept in room state, not just broadcast-and-forget, so someone
  // who reconnects mid-discussion sees what they missed instead of an empty
  // log. Reset every round (see startRound/continueMatch), same as clues.
  chat: { playerId: string; name: string; text: string; ts: number }[];
  // Set when the match had to be cut short instead of resolving through a
  // normal vote — currently only "impostor_disconnected" (see
  // abortMatchImpostorLeft). Absent for a normally-resolved match.
  abortedReason?: "impostor_disconnected";
  // True when the abort happened mid-voting with at least one vote already
  // cast — those votes were discarded, not counted, so the UI can say so
  // explicitly instead of leaving voters to wonder what happened to theirs.
  votesDiscarded?: boolean;
  // True when the elimination that just happened was decided by a random
  // draw among still-tied suspects (MAX_REVOTES exhausted without a clear
  // winner) rather than a clean majority — the UI shows this distinctly so
  // it doesn't read as a normal decisive vote.
  tieBrokenRandomly?: boolean;
  // Set only when rerollWord had to fall back to a full startRound because
  // the category ran out of unused words — a new match (new category, new
  // impostors, cleared eliminations) starting silently would otherwise look
  // like a bug rather than an explained, if unusual, restart.
  restartedReason?: "word_pool_exhausted";
}

function cfg(room: Room): ImpostorConfig {
  return room.config as ImpostorConfig;
}

function round(room: Room): ImpostorRound {
  return room.round as ImpostorRound;
}

const MIN_PLAYERS = 3;

// maxImpostors/matchWinner live in @juntada/impostor-match-rules — shared
// with ConfigPanel.tsx (mirrors the same cap client-side) and LocalGame.tsx
// (re-implements the whole match offline), so a rule change can't drift
// between the three.
const { maxImpostors, matchWinner } = require("@juntada/impostor-match-rules") as {
  maxImpostors: (playerCount: number) => number;
  matchWinner: (impostors: string[], matchEliminated: string[], totalPlayers: number) => "innocents" | "impostors" | null;
};
// A tie at the top keeps re-voting among just the tied suspects rather than
// eliminating one at random — but cap it so a stubborn 1-1 tie between two
// players (who can just keep voting for each other) doesn't loop forever.
const MAX_REVOTES = 2;

function createConfig(): ImpostorConfig {
  return {
    // Off by default — the host has to actively pick which categories are
    // in play (see ConfigPanel.tsx) rather than opt out of a preselected set.
    enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {} as Record<string, boolean>),
    numImpostors: 1,
    hintsEnabled: true,
    clueTime: 90, // seconds, 0 = unlimited
    writtenClues: true, // require typing the clue instead of just saying it out loud
    discussionTime: 30, // seconds, 0 = skip the discussion phase entirely
    discussionUnlimited: false, // discussion phase happens but with no timer/auto-advance — players mark ready manually
    discussionMode: "voice",
    turnOrder: [],
    revealOnElimination: true,
    showCategory: false,
    turnRotation: 0,
  };
}

// Players still in the match — everyone except whoever's been voted out so
// far. Once a round exists, this is the pool every turn/vote/skip action is
// restricted to; before that (no round yet) it's simply everyone.
function aliveIds(room: Room): string[] {
  const eliminated = room.round ? round(room).matchEliminated : [];
  return room.players.filter(p => !eliminated.includes(p.id)).map(p => p.id);
}

// The order this round actually speaks in: the host's configured order,
// filtered down to players still in the room, with anyone missing from it
// (new joins, or a fresh room with no order set yet) appended in arrival
// order — then rotated by turnRotation so the same player isn't stuck going
// first round after round (see startRound/continueMatch, which bump it).
function effectiveTurnOrder(room: Room): string[] {
  const ids = room.players.map(p => p.id);
  const stored = (cfg(room).turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !stored.includes(id));
  const order = [...stored, ...missing];
  if (order.length === 0) return order;
  const rotation = Number.isFinite(cfg(room).turnRotation) ? (cfg(room).turnRotation as number) : 0;
  const offset = ((rotation % order.length) + order.length) % order.length;
  return [...order.slice(offset), ...order.slice(0, offset)];
}

function turnTimerEnd(room: Room): number | null {
  return cfg(room).clueTime > 0 ? Date.now() + cfg(room).clueTime * 1000 : null;
}

// Advances turnIndex past anyone who's currently offline — called right
// after computing the round's turn order and again whenever a turn ends, so
// a disconnected player can never permanently stall the round.
function skipOfflineTurns(room: Room): void {
  const r = round(room);
  while (r.turnIndex < r.turnOrder.length && !room.players.find(p => p.id === r.turnOrder[r.turnIndex])?.online) {
    r.turnIndex += 1;
  }
}

// A malformed update_config (bad client, typo) shouldn't be able to crash the
// server — anything that doesn't look like a real category map is ignored.
function activeCategoryKeys(room: Room): string[] {
  const enabled = cfg(room).enabledCategories;
  if (!enabled || typeof enabled !== "object") return [];
  return Object.keys(CATEGORIES).filter(k => enabled[k]);
}

function pickWord(room: Room, catKey: string, excludeWord: string | null = null): string | null {
  const cat = CATEGORIES[catKey];
  const used = (room.usedWords[catKey] as string[] | undefined) ?? [];
  const available = cat.words.filter(w => !used.includes(w) && w !== excludeWord);
  if (available.length === 0) return null;
  const word = available[Math.floor(Math.random() * available.length)];
  room.usedWords[catKey] = [...used, word];
  return word;
}

function stopRoomTimer(room: Room): void {
  const t = timers.get(room.code);
  if (t) {
    clearTimeout(t);
    timers.delete(room.code);
  }
}

function startRound(room: Room, restartedReason?: "word_pool_exhausted"): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Necesitás al menos ${MIN_PLAYERS} jugadores` };

  const activeCats = activeCategoryKeys(room);
  if (activeCats.length === 0) return { error: "No hay categorías activas" };
  const catKey = activeCats[Math.floor(Math.random() * activeCats.length)];
  const cat = CATEGORIES[catKey];
  const word = pickWord(room, catKey);
  if (!word) return { error: `Sin palabras en ${cat.label}` };

  const playerIds = shuffle(room.players.map(p => p.id)) as string[];
  const numImpostors = Number.isInteger(cfg(room).numImpostors) ? cfg(room).numImpostors : 1;
  const impostorCount = Math.max(1, Math.min(numImpostors, maxImpostors(room.players.length)));
  const impostors = playerIds.slice(0, impostorCount);

  room.round = {
    word,
    categoryKey: catKey,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    impostors,
    clues: {}, // playerId -> clueText ("" for a spoken/confirmed-only turn)
    turnOrder: effectiveTurnOrder(room),
    turnIndex: 0,
    votes: {}, // voterId -> suspectId
    skipVotes: [], // playerIds that asked for a different word this round
    rerollCount: 0,
    matchEliminated: [],
    eliminated: null,
    revealed: false,
    matchOver: false,
    winner: null,
    timerEnd: null,
    discussionEnd: null,
    revoteCandidates: null, // set of tied playerIds when a vote must be repeated
    revoteCount: 0,
    chat: [],
    restartedReason,
  } satisfies ImpostorRound;
  room.phase = "round";
  room.players.forEach(p => {
    p.ready = false;
  });
  skipOfflineTurns(room);
  round(room).timerEnd = round(room).turnIndex < round(room).turnOrder.length ? turnTimerEnd(room) : null;
  cfg(room).turnRotation = (Number.isFinite(cfg(room).turnRotation) ? (cfg(room).turnRotation as number) : 0) + 1;

  return { success: true };
}

// Starts another round of clue-giving within the same match: a fresh turn
// order (limited to whoever's still alive) so there's another chance to
// give clues and vote, but the *same* word/category as before — it's still
// the same investigation, not a new one, so the word only changes when a
// genuinely new match starts (see startRound). Same impostors and
// elimination history carry over too — called after a vote that didn't
// decide the match yet (see tallyVotes).
function continueMatch(room: Room): { success?: true; error?: string } {
  if (!room.round) return { error: "No hay una partida en curso" };
  const prev = round(room);
  if (prev.matchOver) return { error: "La partida ya terminó" };

  const alive = aliveIds(room);
  room.round = {
    word: prev.word,
    categoryKey: prev.categoryKey,
    categoryLabel: prev.categoryLabel,
    categoryIcon: prev.categoryIcon,
    impostors: prev.impostors,
    clues: {},
    turnOrder: effectiveTurnOrder(room).filter(id => alive.includes(id)),
    turnIndex: 0,
    votes: {},
    skipVotes: [],
    rerollCount: 0,
    matchEliminated: prev.matchEliminated,
    eliminated: null,
    revealed: false,
    matchOver: false,
    winner: null,
    timerEnd: null,
    discussionEnd: null,
    revoteCandidates: null,
    revoteCount: 0,
    chat: [],
  } satisfies ImpostorRound;
  room.phase = "round";
  room.players.forEach(p => {
    p.ready = false;
  });
  skipOfflineTurns(room);
  round(room).timerEnd = round(room).turnIndex < round(room).turnOrder.length ? turnTimerEnd(room) : null;
  cfg(room).turnRotation = (Number.isFinite(cfg(room).turnRotation) ? (cfg(room).turnRotation as number) : 0) + 1;

  return { success: true };
}

// Majority of *alive, online* players needed to swap the current word for a
// new one — eliminated players are spectating and don't get a say.
function skipThreshold(room: Room): number {
  const alive = aliveIds(room);
  const online = room.players.filter(p => p.online && alive.includes(p.id)).length;
  return Math.floor(online / 2) + 1;
}

// skipVotes only ever grows (see skip_word below) — if a voter is later
// kicked, eliminated, or goes offline, their id would otherwise linger here
// forever, forming a phantom vote that still counts toward skipThreshold
// even though that threshold is computed over *online* players only. Left
// unfiltered, a word could get skipped on votes cast entirely by players
// who've since disconnected, with nobody currently online ever agreeing to
// it — mirror the same online+alive filter skipThreshold itself uses.
// Always read the count through this filter instead of skipVotes.length.
function activeSkipVotes(room: Room): string[] {
  const alive = aliveIds(room);
  return round(room).skipVotes.filter(id => alive.includes(id) && room.players.find(p => p.id === id)?.online);
}

// Swaps the word for a fresh one from the same category, keeping the same
// impostors — this is meant to feel instant, not like starting the round
// over. Only falls back to a full re-shuffle (new category, new impostors)
// if that category has no words left to offer.
// Returns whether it actually changed anything — false in the extremely
// rare case where every active category is completely out of words (not
// just this one), so startRound's own fallback has nothing left to draw
// from either. The caller (skip_word) uses this to avoid leaving skipVotes
// stuck at a satisfied threshold forever, which would otherwise silently
// re-attempt (and re-fail) the same reroll on every future skip_word call.
function rerollWord(room: Room): boolean {
  const word = pickWord(room, round(room).categoryKey, round(room).word);
  if (!word) {
    const res = startRound(room, "word_pool_exhausted");
    return !!res.success;
  }

  round(room).word = word;
  round(room).skipVotes = [];
  round(room).rerollCount += 1;
  round(room).timerEnd = turnTimerEnd(room);
  return true;
}

// An impostor's clue/vote is the entire point of the round — once they're
// truly gone (kicked, by timeout or by the host — see maybeAdvance's
// goneImpostor check, which only fires once they're actually removed from
// room.players, not merely offline) there's no honest way to finish the
// round (they can never give a clue or be voted out again), so the match is
// cut short right away instead of letting the innocents "win" a round that
// never actually got decided.
function abortMatchImpostorLeft(room: Room): void {
  stopRoomTimer(room);
  const r = round(room);
  const votesDiscarded = room.phase === "voting" && Object.keys(r.votes).length > 0;
  r.matchOver = true;
  r.winner = null;
  r.revealed = true;
  r.abortedReason = "impostor_disconnected";
  r.votesDiscarded = votesDiscarded;
  room.phase = "result";
  room.roundHistory.push({
    word: r.word,
    categoryLabel: r.categoryLabel,
    categoryIcon: r.categoryIcon,
    impostors: r.impostors,
    eliminated: r.eliminated,
    wasImpostor: r.wasImpostor,
    tally: r.tally || {},
    matchOver: true,
    winner: null,
    abortedReason: "impostor_disconnected",
    votesDiscarded,
  });
}

function tallyVotes(room: Room): void {
  const r = round(room);
  const alive = aliveIds(room);
  const tally: Record<string, number> = {};
  alive.forEach(id => {
    tally[id] = 0;
  });
  Object.values(r.votes).forEach(id => {
    if (tally[id] != null) tally[id] += 1;
  });
  const maxVotes = Math.max(...Object.values(tally));
  const topVoted = Object.entries(tally)
    .filter(([, v]) => v === maxVotes)
    .map(([id]) => id);

  // Tie at the top: repeat the vote among just the tied suspects instead of
  // eliminating one at random, up to MAX_REVOTES times.
  if (topVoted.length > 1 && maxVotes > 0 && r.revoteCount < MAX_REVOTES) {
    r.revoteCandidates = topVoted;
    r.revoteCount += 1;
    r.votes = {};
    r.tally = tally;
    room.phase = "voting";
    return;
  }

  // Reaching here with more than one still-tied top suspect only happens
  // once MAX_REVOTES is exhausted (the tie-repeat branch above already
  // returned otherwise) — flag it so the UI can say this elimination was a
  // random draw, not a clean majority decision.
  const tieBrokenRandomly = topVoted.length > 1;
  const eliminatedId = topVoted[Math.floor(Math.random() * topVoted.length)];
  const wasImpostor = r.impostors.includes(eliminatedId);
  r.matchEliminated = [...r.matchEliminated, eliminatedId];
  r.eliminated = eliminatedId;
  r.tally = tally;
  r.wasImpostor = wasImpostor;
  r.tieBrokenRandomly = tieBrokenRandomly;

  // otherwise there's another round of clue-giving to go (continueMatch) —
  // see @juntada/impostor-match-rules for the actual win condition.
  const winner = matchWinner(r.impostors, r.matchEliminated, room.players.length);

  r.matchOver = winner !== null;
  r.winner = winner;
  // Each elimination reveals the eliminated player's role only if the host
  // opted in — but once the match is actually over there's nothing left to
  // protect, so the full outcome always shows.
  r.revealed = r.matchOver || !!cfg(room).revealOnElimination;

  room.phase = "result";
  room.roundHistory.push({
    word: r.word,
    categoryLabel: r.categoryLabel,
    categoryIcon: r.categoryIcon,
    impostors: r.impostors,
    eliminated: eliminatedId,
    wasImpostor,
    tally,
    matchOver: r.matchOver,
    winner: r.winner,
    tieBrokenRandomly,
  });
}

function enterVoting(room: Room): void {
  room.phase = "voting";
  round(room).discussionEnd = null;
}

function enterDiscussionOrVoting(room: Room): void {
  stopRoomTimer(room); // clear the round's clue-timer, we're leaving that phase
  const discussionTime = Number.isFinite(cfg(room).discussionTime) ? cfg(room).discussionTime : 0;
  const unlimited = !!cfg(room).discussionUnlimited;
  // discussionTime === 0 without "unlimited" means the host chose to skip
  // the discussion phase entirely, straight to voting. With "unlimited" on,
  // the phase still happens but nothing forces it to end — same as clueTime
  // === 0 already does for the round phase — players advance by hand.
  if (discussionTime <= 0 && !unlimited) {
    enterVoting(room);
    return;
  }
  room.phase = "discussion";
  round(room).discussionEnd = unlimited ? null : Date.now() + discussionTime * 1000;
  room.players.forEach(p => {
    p.ready = false;
  });
}

// Moves to the next turn in the round phase, skipping anyone offline; once
// the order is exhausted, moves on to discussion/voting.
function advanceTurn(room: Room): void {
  const r = round(room);
  r.turnIndex += 1;
  skipOfflineTurns(room);
  if (r.turnIndex >= r.turnOrder.length) {
    enterDiscussionOrVoting(room);
  } else {
    r.timerEnd = turnTimerEnd(room);
  }
}

// Re-checks whether the round/discussion/voting phase can advance now that a
// player's turn/ready/vote status or online status changed. Eliminated
// players are spectating, so only alive+online players' state ever counts.
function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  const r0 = round(room);
  if (r0.matchOver) return;

  // Merely offline isn't enough to abort — that just means they dropped and
  // might reconnect any second (see roomHandlers.ts's schedulePlayerKick,
  // which gives every disconnected player a 10-minute grace period before
  // actually removing them from room.players). Only a genuinely *gone*
  // impostor (kicked, by timeout or by the host) makes the round impossible
  // to finish honestly.
  const goneImpostor = r0.impostors.find(id => !r0.matchEliminated.includes(id) && !room.players.some(p => p.id === id));
  if (goneImpostor) {
    abortMatchImpostorLeft(room);
    return;
  }

  const alive = aliveIds(room);
  const online = room.players.filter(p => p.online && alive.includes(p.id));
  if (online.length === 0) return;

  if (room.phase === "round") {
    skipOfflineTurns(room);
    if (round(room).turnIndex >= round(room).turnOrder.length) enterDiscussionOrVoting(room);
  } else if (room.phase === "discussion" && online.every(p => p.ready)) {
    stopRoomTimer(room);
    enterVoting(room);
  } else if (room.phase === "voting") {
    const votedCount = online.filter(p => round(room).votes[p.id] != null).length;
    if (votedCount >= online.length) {
      tallyVotes(room);
    }
  }
}

// Called by the transport layer when a scheduled phase timer fires. During
// the round phase that means the current turn's clock ran out — treat it as
// an implicit pass (no clue) and move to the next turn. Everywhere else it
// acts as if every online player just pressed "ready".
function forceReadyAndAdvance(room: Room): void {
  if (room.phase === "round") {
    const r = round(room);
    if (r.turnIndex < r.turnOrder.length) {
      const currentId = r.turnOrder[r.turnIndex];
      if (r.clues[currentId] == null) r.clues[currentId] = "";
      advanceTurn(room);
    }
    return;
  }
  const alive = aliveIds(room);
  room.players.forEach(p => {
    if (p.online && alive.includes(p.id)) p.ready = true;
  });
  maybeAdvance(room);
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  if (!room.round) return { handled: false };
  switch (action) {
    // Sends everyone back to the lobby so the host can reconfigure
    // (categories, number of impostors, ...) before the next match, same as
    // every other game's "Nueva partida" — startRound alone would skip
    // straight into a fresh match with whatever config was already set.
    case "new_game": {
      if (playerId !== room.hostId) return { handled: false };
      if (!round(room).matchOver) return { handled: false };
      room.round = null;
      room.phase = "lobby";
      room.players.forEach(p => {
        p.ready = false;
      });
      return { handled: true };
    }

    // Turn-based: only the player whose turn it currently is can submit —
    // with writtenClues on they have to actually type something; otherwise
    // this is just their "I said it out loud" confirmation (empty clue).
    // Either way, submitting hands the turn to the next player.
    case "submit_clue": {
      if (room.phase !== "round") return { handled: false };
      const r = round(room);
      if (r.turnOrder[r.turnIndex] !== playerId) return { handled: false };
      if (cfg(room).writtenClues) {
        const clue = String(payload.clue ?? "").trim();
        if (!clue) return { handled: false };
        r.clues[playerId] = clue;
      } else {
        r.clues[playerId] = "";
      }
      advanceTurn(room);
      return { handled: true };
    }

    case "player_ready": {
      if (room.phase !== "discussion") return { handled: false };
      if (!aliveIds(room).includes(playerId)) return { handled: false };
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      maybeAdvance(room);
      return { handled: true };
    }

    case "vote": {
      if (room.phase !== "voting") return { handled: false };
      const alive = aliveIds(room);
      if (!alive.includes(playerId)) return { handled: false };
      const { revoteCandidates } = round(room);
      const suspectId = payload.suspectId as string;
      const eligible = alive.includes(suspectId) && (!revoteCandidates || revoteCandidates.includes(suspectId));
      if (!eligible) return { handled: false };
      round(room).votes[playerId] = suspectId;
      maybeAdvance(room);
      return { handled: true };
    }

    case "skip_word": {
      if (room.phase !== "round") return { handled: false };
      if (!aliveIds(room).includes(playerId)) return { handled: false };
      if (!round(room).skipVotes.includes(playerId)) round(room).skipVotes.push(playerId);
      if (activeSkipVotes(room).length >= skipThreshold(room)) {
        // Every active category being completely exhausted (not just the
        // current one) is a corner case with no good recovery — clear the
        // votes instead of leaving them stuck at a satisfied threshold,
        // which would otherwise silently retry (and re-fail) this same
        // reroll on every subsequent skip_word call.
        if (!rerollWord(room)) {
          round(room).skipVotes = [];
          return { handled: true };
        }
        return { handled: true, rerolled: true };
      }
      return { handled: true };
    }

    // Lets someone take back a "pedir otra palabra" request before it's
    // acted on — otherwise the only way to undo a mis-tap is to wait for
    // either the threshold to be reached or the round to move on its own.
    case "cancel_skip_word": {
      if (room.phase !== "round") return { handled: false };
      round(room).skipVotes = round(room).skipVotes.filter(id => id !== playerId);
      return { handled: true };
    }

    // The discussion-phase chat — only when the host configured
    // discussionMode "chat" for this match; a "voice" match has nothing for
    // the server to do here, so the message is simply rejected (the client
    // shouldn't be showing an input in that case at all).
    case "send_chat_message": {
      if (room.phase !== "discussion") return { handled: false };
      if (cfg(room).discussionMode !== "chat") return { handled: false };
      if (!aliveIds(room).includes(playerId)) return { handled: false };
      const text = String(payload.text ?? "").trim();
      if (!text) return { handled: false };
      const player = room.players.find(p => p.id === playerId);
      if (!player) return { handled: false };
      round(room).chat.push({ playerId, name: player.name, text: text.slice(0, 300), ts: Date.now() });
      return { handled: true };
    }

    // Host-only — moves on to another round of clue-giving within the same
    // match after a vote that didn't decide it yet.
    case "continue_round": {
      if (playerId !== room.hostId) return { handled: false };
      if (room.phase !== "result") return { handled: false };
      if (round(room).matchOver) return { handled: false };
      const res = continueMatch(room);
      return { handled: !!res.success, rerolled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  return {
    categoryLabel: r.categoryLabel,
    categoryIcon: r.categoryIcon,
    impostorCount: r.impostors.length,
    timerEnd: r.timerEnd,
    discussionEnd: r.discussionEnd,
    turnOrder: r.turnOrder,
    turnIndex: r.turnIndex,
    clues: r.clues,
    votes: r.votes,
    matchEliminated: r.matchEliminated,
    eliminated: r.eliminated,
    // Only this vote's outcome is gated by `revealed` (the host's
    // revealOnElimination setting) — the full impostor roster stays hidden
    // until the match is actually decided, win or lose.
    wasImpostor: r.revealed ? r.wasImpostor : undefined,
    tally: r.tally,
    impostors: r.matchOver ? r.impostors : undefined,
    matchOver: r.matchOver,
    winner: r.winner,
    abortedReason: r.abortedReason,
    votesDiscarded: r.votesDiscarded,
    tieBrokenRandomly: r.tieBrokenRandomly,
    restartedReason: r.restartedReason,
    skipVotes: activeSkipVotes(room).length,
    skipVoterIds: activeSkipVotes(room),
    skipVotesNeeded: skipThreshold(room),
    rerollCount: r.rerollCount,
    revoteCandidates: r.revoteCandidates,
    revoteCount: r.revoteCount,
    chat: cfg(room).discussionMode === "chat" ? r.chat : undefined,
  };
}

function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  const isImpostor = r.impostors.includes(playerId);
  // Eliminated players are spectating — no more secrets to protect from
  // them, so they get to see the word and who's who for the rest of the
  // match.
  const isEliminated = r.matchEliminated.includes(playerId);
  return {
    isImpostor,
    isEliminated,
    word: isImpostor && !isEliminated ? null : r.word,
    hint: isImpostor && !isEliminated && cfg(room).hintsEnabled ? wordHint(r.categoryKey, r.word) : null,
  };
}

// Extra broadcast fired the moment a round resolves, so every screen can show
// the reveal even if the "result" state's round object gets replaced later.
function getRevealMessage(room: Room): ({ type: string } & Record<string, unknown>) | null {
  if (!room.round) return null;
  const r = round(room);
  return { type: "word_reveal", word: r.word, categoryLabel: r.categoryLabel };
}

// The phase-relevant timestamp the transport layer should schedule an
// auto-advance for (see forceReadyAndAdvance), or null if none applies.
function getPhaseTimerEnd(room: Room): number | null {
  if (room.phase === "round") return round(room)?.timerEnd ?? null;
  if (room.phase === "discussion") return round(room)?.discussionEnd ?? null;
  return null;
}

// Turn order can't wait out the 10-minute auto-kick grace period just because
// it's currently the disconnected player's turn — unlike a vote/ready
// count, skipping a turn costs them nothing permanent (the comment on
// skipOfflineTurns above still applies: they get their turn back next lap
// if they reconnect), so this reacts immediately instead of waiting for a
// real removal. Scoped to "it's specifically their turn right now" so a
// disconnect elsewhere in the turn order (not yet their turn) doesn't
// trigger an unrelated phase transition.
function onPlayerOffline(room: Room, playerId: string): void {
  if (!room.round || room.phase !== "round") return;
  const r = round(room);
  if (r.turnOrder[r.turnIndex] !== playerId) return;
  // Same implicit-pass treatment as a timed-out turn (forceReadyAndAdvance).
  if (r.clues[playerId] == null) r.clues[playerId] = "";
  advanceTurn(room);
}

// A stuck vote blocks the whole table (see maybeAdvance's online-only quorum)
// — 5 minutes instead of the generic 10 is enough grace for a real
// reconnect without leaving everyone else waiting that much longer just to
// find out someone actually left. Every other phase keeps the default.
function offlineKickTimeoutMs(room: Room): number | undefined {
  return room.phase === "voting" ? 5 * 60 * 1000 : undefined;
}

const engine: GameEngine = {
  id: "impostor",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  forceReadyAndAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
  getPhaseTimerEnd,
  onPlayerOffline,
  offlineKickTimeoutMs,
};

module.exports = engine;
