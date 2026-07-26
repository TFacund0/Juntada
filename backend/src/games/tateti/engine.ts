// ─── Ta-Te-Ti Game Engine ────────────────────────────────────────────────────
// Classic 1v1 tic-tac-toe. Score (wins per player + draws) lives in
// room.config so it survives across rematches — room.round only holds the
// current board. Starting player alternates each game so nobody is stuck
// always going second. Rematches and score resets both need both players to
// agree: rematch reuses the generic "player_ready" action (checked off once
// each, same as Impostor's ready-up), and reset uses its own vote list.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

const { checkWinner } = require("@juntada/tateti-board") as typeof import("@juntada/tateti-board");

interface TatetiConfig {
  score: Record<string, number>;
  draws: number;
  resetVotes: string[];
  lastStarterId?: string;
  [key: string]: unknown;
}

interface TatetiRound {
  board: (string | null)[];
  marks: Record<string, string>;
  turn: string | undefined;
  winner: string | null;
  winningLine: number[] | null;
  // Set instead of a real winningLine when the round ended because the
  // opponent actually left (not just went offline) rather than being beaten
  // fair and square — lets the UI say "ganó por abandono" instead of
  // implying a real three-in-a-row that never happened.
  forfeited?: boolean;
}

function cfg(room: Room): TatetiConfig {
  return room.config as TatetiConfig;
}

function round(room: Room): TatetiRound {
  return room.round as TatetiRound;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 2;

function createConfig(): TatetiConfig {
  return { score: {}, draws: 0, resetVotes: [] };
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length !== MAX_PLAYERS) return { error: `Se necesitan exactamente ${MAX_PLAYERS} jugadores` };

  const [p1, p2] = room.players;
  const startingId = cfg(room).lastStarterId === p1.id ? p2.id : p1.id;
  const otherId = startingId === p1.id ? p2.id : p1.id;
  cfg(room).lastStarterId = startingId;

  room.round = {
    board: Array(9).fill(null),
    marks: { [startingId]: "X", [otherId]: "O" },
    turn: startingId,
    winner: null,
    winningLine: null,
  } satisfies TatetiRound;
  room.phase = "round";
  room.players.forEach(p => {
    p.ready = false;
  });
  return { success: true };
}

// Only relevant right after a match ends: once both online players have
// checked "jugar de nuevo" (player_ready), start the rematch automatically.
// Also the only place that ever re-runs once a player is actually removed
// (see roomHandlers.ts's schedulePlayerKick, called after the standard
// 5-minute disconnect grace period) — a strict 1v1 game has no way to
// continue, or even to resolve a pending rematch/reset vote, with only one
// player left, so both cases get handled here instead of leaving the
// remaining player staring at a "esperando a X" that can never resolve.
function maybeAdvance(room: Room): void {
  if (!room?.round) return;
  if (room.players.length < MAX_PLAYERS) {
    if (room.phase === "round") {
      const remaining = room.players[0];
      if (remaining) finishWithForfeit(room, remaining.id);
    } else if (room.phase === "result") {
      // Send the room back to the lobby (clearing the round and any
      // pending rematch/reset-vote state) so a new second player can
      // actually join — roomService.joinRoom only allows joining while
      // phase is "lobby".
      room.round = null;
      room.phase = "lobby";
      cfg(room).resetVotes = [];
      room.players.forEach(p => {
        p.ready = false;
      });
    }
    return;
  }
  if (room.phase !== "result") return;
  const online = room.players.filter(p => p.online);
  if (online.length === MAX_PLAYERS && online.every(p => p.ready)) startRound(room);
}

function finishWithWinner(room: Room, playerId: string, line: number[]): void {
  round(room).winner = playerId;
  round(room).winningLine = line;
  room.phase = "result";
  cfg(room).score[playerId] = (cfg(room).score[playerId] || 0) + 1;
}

// The opponent actually left mid-round (not just offline — onPlayerOffline
// deliberately doesn't exist here, same reasoning as every other game: a
// brief blip shouldn't cost a real loss) — a 1v1 game can't continue with
// one player, so the one who's still here gets credited the win instead of
// the board staying frozen forever.
function finishWithForfeit(room: Room, winnerId: string): void {
  const r = round(room);
  r.winner = winnerId;
  r.winningLine = null;
  r.forfeited = true;
  room.phase = "result";
  cfg(room).score[winnerId] = (cfg(room).score[winnerId] || 0) + 1;
}

function finishWithDraw(room: Room): void {
  round(room).winner = "draw";
  room.phase = "result";
  cfg(room).draws = (cfg(room).draws || 0) + 1;
}

function resetProgress(room: Room): void {
  cfg(room).score = {};
  cfg(room).draws = 0;
  cfg(room).resetVotes = [];
}

function handleAction(room: Room, playerId: string, action: string, payload: Record<string, unknown>): { handled: boolean } {
  switch (action) {
    case "mark": {
      if (!room.round || room.phase !== "round") return { handled: false };
      if (round(room).turn !== playerId) return { handled: false };
      const index = payload?.index as number;
      if (!Number.isInteger(index) || index < 0 || index > 8) return { handled: false };
      if (round(room).board[index] !== null) return { handled: false };

      round(room).board[index] = round(room).marks[playerId];
      const line = checkWinner(round(room).board);
      if (line) {
        finishWithWinner(room, playerId, line);
      } else if (round(room).board.every(cell => cell !== null)) {
        finishWithDraw(room);
      } else {
        round(room).turn = room.players.find(p => p.id !== playerId)?.id;
      }
      return { handled: true };
    }

    case "player_ready": {
      if (!room.round || room.phase !== "result") return { handled: false };
      const p = room.players.find(p => p.id === playerId);
      if (p) p.ready = true;
      maybeAdvance(room);
      return { handled: true };
    }

    // Both players need to ask for it before the scoreboard actually resets —
    // one side clicking "reiniciar" alone just marks their vote and waits.
    case "reset_score_vote": {
      if (!room.round) return { handled: false };
      const votes = cfg(room).resetVotes;
      if (!votes.includes(playerId)) votes.push(playerId);
      const online = room.players.filter(p => p.online);
      if (online.length === MAX_PLAYERS && online.every(p => votes.includes(p.id))) {
        resetProgress(room);
      }
      return { handled: true };
    }

    // Either side can wipe a pending request back to neutral — the
    // requester backing out of their own ask, or the other player declining
    // it. Either way both players end up seeing the plain "Reiniciar
    // marcador" button again, not a half-retracted state.
    case "cancel_score_reset": {
      if (!room.round) return { handled: false };
      cfg(room).resetVotes = [];
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  return {
    board: r.board,
    marks: r.marks,
    turn: r.turn,
    winner: r.winner,
    winningLine: r.winningLine,
    forfeited: r.forfeited,
  };
}

function getPrivateView(): null {
  return null;
}

function getRevealMessage(): null {
  return null;
}

const engine: GameEngine = {
  id: "tateti",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
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
