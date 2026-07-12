// ─── Ta-Te-Ti Game Engine ────────────────────────────────────────────────────
// Classic 1v1 tic-tac-toe. Score (wins per player + draws) lives in
// room.config so it survives across rematches — room.round only holds the
// current board. Starting player alternates each game so nobody is stuck
// always going second. Rematches and score resets both need both players to
// agree: rematch reuses the generic "player_ready" action (checked off once
// each, same as Impostor's ready-up), and reset uses its own vote list.

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

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
}

function cfg(room: Room): TatetiConfig {
  return room.config as TatetiConfig;
}

function round(room: Room): TatetiRound {
  return room.round as TatetiRound;
}

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 2;

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function createConfig(): TatetiConfig {
  return { score: {}, draws: 0, resetVotes: [] };
}

function checkWinner(board: (string | null)[]): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
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
function maybeAdvance(room: Room): void {
  if (!room?.round || room.phase !== "result") return;
  const online = room.players.filter(p => p.online);
  if (online.length === MAX_PLAYERS && online.every(p => p.ready)) startRound(room);
}

function finishWithWinner(room: Room, playerId: string, line: number[]): void {
  round(room).winner = playerId;
  round(room).winningLine = line;
  room.phase = "result";
  cfg(room).score[playerId] = (cfg(room).score[playerId] || 0) + 1;
}

function finishWithDraw(room: Room): void {
  round(room).winner = "draw";
  room.phase = "result";
  cfg(room).draws = (cfg(room).draws || 0) + 1;
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
      if (!cfg(room).resetVotes.includes(playerId)) cfg(room).resetVotes.push(playerId);
      const online = room.players.filter(p => p.online);
      if (online.length === MAX_PLAYERS && online.every(p => cfg(room).resetVotes.includes(p.id))) {
        cfg(room).score = {};
        cfg(room).draws = 0;
        cfg(room).resetVotes = [];
      }
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
};

module.exports = engine;
