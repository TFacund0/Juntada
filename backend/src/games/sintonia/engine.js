// ─── Sintonía Game Engine ────────────────────────────────────────────────────
// Wavelength-style: each round a different player is the "psíquico" — they see
// a secret 0-100 target on a dial between two opposite concepts (public to
// everyone) and write a clue phrase for it. Everyone else then submits their
// own guess at where the target is. Points are competitive: each guesser
// scores based on how close their own guess landed, and the psychic scores
// the sum of every guesser's points (a clue that gets everyone close is worth
// as much as the whole group combined).
//
// Phases: setup (host picks who's psychic + which spectrum pair to use, or
// leaves it to chance) -> clue (psychic writes the phrase) -> guess (everyone
// else submits a value) -> result (target revealed, points awarded).
// start_round always re-enters "setup"; that's what powers both "Iniciar
// ronda" from the lobby and "Nueva ronda" after a result.

const { SPECTRUMS } = require("@juntada/sintonia-data");

const MIN_PLAYERS = 2;

function scoreFor(diff) {
  if (diff <= 3) return 4;
  if (diff <= 8) return 3;
  if (diff <= 15) return 2;
  return 0;
}

function randomTarget() {
  return 8 + Math.floor(Math.random() * 85); // 8..92, evita los extremos
}

function createConfig() {
  return { score: {}, turnIdx: 0 };
}

function pickSpectrum(room) {
  const key = ([l, r]) => `${l}|${r}`;
  const used = room.usedWords.spectrums || [];
  let available = SPECTRUMS.filter(pair => !used.includes(key(pair)));
  if (available.length === 0) { room.usedWords.spectrums = []; available = SPECTRUMS; }
  const [left, right] = available[Math.floor(Math.random() * available.length)];
  room.usedWords.spectrums = [...(room.usedWords.spectrums || []), key([left, right])];
  return { left, right };
}

// Enters the "choose psychic / choose spectrum" step. No round-specific data
// is committed yet — getPublicRoundView derives the suggested defaults live
// from room state so they always reflect the current player list.
function startRound(room) {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  room.round = null;
  room.phase = "setup";
  return { success: true };
}

function finishRound(room) {
  const round = room.round;
  const guesserIds = Object.keys(round.guesses);
  const pointsByPlayer = {};
  guesserIds.forEach(pid => {
    const diff = Math.abs(round.guesses[pid] - round.target);
    pointsByPlayer[pid] = scoreFor(diff);
  });
  // El psíquico gana lo mismo que sumaron entre todos los que adivinaron —
  // así una buena pista (que acerca a todos) vale tanto como acertar uno solo.
  const psychicBonus = guesserIds.reduce((sum, pid) => sum + pointsByPlayer[pid], 0);
  pointsByPlayer[round.psychicId] = (pointsByPlayer[round.psychicId] || 0) + psychicBonus;

  Object.entries(pointsByPlayer).forEach(([pid, pts]) => {
    room.config.score[pid] = (room.config.score[pid] || 0) + pts;
  });

  round.pointsByPlayer = pointsByPlayer;
  round.psychicBonus = psychicBonus;
  room.phase = "result";
  room.roundHistory.push({
    left: round.left, right: round.right, target: round.target,
    psychicId: round.psychicId, guesses: round.guesses,
    pointsByPlayer, psychicBonus,
  });
}

function maybeAdvance(room) {
  if (!room?.round || room.phase !== "guess") return;
  const online = room.players.filter(p => p.online && p.id !== room.round.psychicId);
  if (online.length === 0) return;
  if (online.every(p => room.round.guesses[p.id] != null)) finishRound(room);
}

// Only the host can finalize the round's setup — payload lets them override
// who's psychic (a specific id, or "random") and how the spectrum pair is
// picked ("same" as last round, "random" from the pool, or "manual" with
// their own left/right text).
function confirmRoundSetup(room, playerId, payload) {
  if (room.phase !== "setup") return { handled: false };
  if (playerId !== room.hostId) return { handled: false };

  let psychicId = payload?.psychicId;
  if (!psychicId || psychicId === "random" || !room.players.some(p => p.id === psychicId)) {
    psychicId = room.players[Math.floor(Math.random() * room.players.length)].id;
  }
  const psychicIdx = room.players.findIndex(p => p.id === psychicId);

  const mode = payload?.spectrumMode || "random";
  const lastRound = room.roundHistory[room.roundHistory.length - 1];
  let left, right;
  if (mode === "same" && lastRound) {
    left = lastRound.left; right = lastRound.right;
  } else if (mode === "manual" && (payload?.left || "").trim() && (payload?.right || "").trim()) {
    left = payload.left.trim(); right = payload.right.trim();
  } else {
    ({ left, right } = pickSpectrum(room));
  }

  room.config.turnIdx = psychicIdx + 1;
  room.round = {
    left, right,
    target: randomTarget(),
    psychicId,
    clue: null,
    guesses: {},
    pointsByPlayer: null,
    psychicBonus: null,
  };
  room.phase = "clue";
  return { handled: true, rerolled: true }; // fresh private info (target) for everyone
}

function handleAction(room, playerId, action, payload) {
  switch (action) {
    case "confirm_round_setup":
      return confirmRoundSetup(room, playerId, payload);

    case "submit_clue": {
      if (!room.round || room.phase !== "clue") return { handled: false };
      if (playerId !== room.round.psychicId) return { handled: false };
      const clue = (payload.clue || "").trim();
      if (!clue) return { handled: false };
      room.round.clue = clue;
      room.phase = "guess";
      return { handled: true };
    }

    case "submit_guess": {
      if (!room.round || room.phase !== "guess") return { handled: false };
      if (playerId === room.round.psychicId) return { handled: false };
      const value = payload?.value;
      if (!Number.isInteger(value) || value < 0 || value > 100) return { handled: false };
      room.round.guesses[playerId] = value;
      maybeAdvance(room);
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function getPublicRoundView(room) {
  if (room.phase === "setup") {
    const turnIdx = room.config.turnIdx || 0;
    const lastRound = room.roundHistory[room.roundHistory.length - 1];
    return {
      setup: true,
      suggestedPsychicId: room.players[turnIdx % room.players.length]?.id ?? null,
      lastSpectrum: lastRound ? { left: lastRound.left, right: lastRound.right } : null,
    };
  }
  if (!room.round) return null;
  const round = room.round;
  const guessersOnline = room.players.filter(p => p.online && p.id !== round.psychicId).length;
  return {
    left: round.left,
    right: round.right,
    psychicId: round.psychicId,
    clue: round.clue,
    submittedCount: Object.keys(round.guesses).length,
    guessersOnline,
    target: room.phase === "result" ? round.target : null,
    guesses: room.phase === "result" ? round.guesses : null,
    pointsByPlayer: room.phase === "result" ? round.pointsByPlayer : null,
    psychicBonus: room.phase === "result" ? round.psychicBonus : null,
  };
}

function getPrivateView(room, playerId) {
  const round = room.round;
  if (!round || room.phase === "setup") return null;
  const isPsychic = playerId === round.psychicId;
  return { isPsychic, target: isPsychic ? round.target : null };
}

function getRevealMessage(room) {
  if (!room.round) return null;
  return { type: "word_reveal", target: room.round.target, left: room.round.left, right: room.round.right };
}

module.exports = {
  id: "sintonia",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
};
