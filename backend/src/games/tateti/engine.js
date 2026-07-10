// ─── Ta-Te-Ti Game Engine ────────────────────────────────────────────────────
// Classic 1v1 tic-tac-toe. Score (wins per player + draws) lives in
// room.config so it survives across rematches — room.round only holds the
// current board. Starting player alternates each game so nobody is stuck
// always going second. Rematches and score resets both need both players to
// agree: rematch reuses the generic "player_ready" action (checked off once
// each, same as Impostor's ready-up), and reset uses its own vote list.

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 2;

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function createConfig() {
  return { score: {}, draws: 0, resetVotes: [] };
}

function checkWinner(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function startRound(room) {
  if (room.players.length !== MAX_PLAYERS) return { error: `Se necesitan exactamente ${MAX_PLAYERS} jugadores` };

  const [p1, p2] = room.players;
  const startingId = room.config.lastStarterId === p1.id ? p2.id : p1.id;
  const otherId = startingId === p1.id ? p2.id : p1.id;
  room.config.lastStarterId = startingId;

  room.round = {
    board: Array(9).fill(null),
    marks: { [startingId]: "X", [otherId]: "O" },
    turn: startingId,
    winner: null,
    winningLine: null,
  };
  room.phase = "round";
  room.players.forEach(p => { p.ready = false; });
  return { success: true };
}

// Only relevant right after a match ends: once both online players have
// checked "jugar de nuevo" (player_ready), start the rematch automatically.
function maybeAdvance(room) {
  if (!room?.round || room.phase !== "result") return;
  const online = room.players.filter(p => p.online);
  if (online.length === MAX_PLAYERS && online.every(p => p.ready)) startRound(room);
}

function finishWithWinner(room, playerId, line) {
  room.round.winner = playerId;
  room.round.winningLine = line;
  room.phase = "result";
  room.config.score[playerId] = (room.config.score[playerId] || 0) + 1;
}

function finishWithDraw(room) {
  room.round.winner = "draw";
  room.phase = "result";
  room.config.draws = (room.config.draws || 0) + 1;
}

function handleAction(room, playerId, action, payload) {
  switch (action) {
    case "mark": {
      if (!room.round || room.phase !== "round") return { handled: false };
      if (room.round.turn !== playerId) return { handled: false };
      const index = payload?.index;
      if (!Number.isInteger(index) || index < 0 || index > 8) return { handled: false };
      if (room.round.board[index] !== null) return { handled: false };

      room.round.board[index] = room.round.marks[playerId];
      const line = checkWinner(room.round.board);
      if (line) {
        finishWithWinner(room, playerId, line);
      } else if (room.round.board.every(cell => cell !== null)) {
        finishWithDraw(room);
      } else {
        room.round.turn = room.players.find(p => p.id !== playerId)?.id;
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
      if (!room.config.resetVotes.includes(playerId)) room.config.resetVotes.push(playerId);
      const online = room.players.filter(p => p.online);
      if (online.length === MAX_PLAYERS && online.every(p => room.config.resetVotes.includes(p.id))) {
        room.config.score = {};
        room.config.draws = 0;
        room.config.resetVotes = [];
      }
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room) {
  if (!room.round) return null;
  return {
    board: room.round.board,
    marks: room.round.marks,
    turn: room.round.turn,
    winner: room.round.winner,
    winningLine: room.round.winningLine,
  };
}

function getPrivateView() {
  return null;
}

function getRevealMessage() {
  return null;
}

module.exports = {
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
