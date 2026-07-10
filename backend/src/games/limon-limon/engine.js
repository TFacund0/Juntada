// ─── Limón Limón Game Engine ─────────────────────────────────────────────────
// Mazo de cartas española (40 cartas) en el centro de una ronda. Por turno,
// el jugador de turno "revela" la carta de arriba del mazo y luego decide (en
// conjunto con el grupo, en voz alta) quién se la come — el motor nunca asigna
// nada solo, solo registra la elección manual. Cada valor de carta tiene una
// descripción editable (config.descriptions) que es puramente informativa: no
// dispara ningún efecto automático. Los jugadores pueden sumarse en cualquier
// momento (roomService.joinRoom ya permite unirse durante la fase "round") y
// entran al final del orden de turno. Termina cuando se acaba el mazo; gana
// quien tiene menos cartas en su pila, pierde quien tiene más.

const MIN_PLAYERS = 2;

const SUITS = ["oro", "copa", "espada", "basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Cada carta (número + palo) es una combinación distinta y puede tener su
// propio significado — pero las reglas son las mismas en los 4 palos, con
// una sola excepción: el 1 de oro duplica el castigo, mientras que el 1 de
// copa/espada/basto es un castigo simple (todas se pueden editar por
// separado, ver "edit_descriptions" y frontend/.../DescriptionsEditor.jsx).
const BASE_DESCRIPTIONS = {
  1: "Te la comés vos mismo.",
  2: "Come la carta el jugador a la derecha de quien la reveló.",
  3: "Quien reveló la carta elige quién se la come.",
  4: "Cuenten cuatro jugadores a la derecha empezando por quien reveló (que cuenta como el primero): el cuarto se la come.",
  5: "Elijan un tema (por ejemplo, selecciones de fútbol) y vayan diciendo uno por turno; quien se traba o repite, se come la carta.",
  6: "Juego del limón: quien reveló dice \"un limón, medio limón, tres limones\" y el turno salta a la tercera persona a la derecha. Desde ahí, cada uno suma uno a la frase (\"tres limones, medio limón, cuatro limones\", después \"cuatro... cinco\", etc.) pasando siempre hacia la derecha. Quien se traba, se come la carta.",
  7: "Todos se tocan la nariz a la vez — el último en tocársela se come la carta.",
  10: "Elijan un tema nuevo y vayan diciendo uno por turno, como en el 5; quien se traba, se come la carta.",
  11: "Palito: quien reveló dice \"palito\", el de la derecha \"palito, palito\", el siguiente \"palito, palito, palito\", sumando uno cada vez. Quien se confunde, se come la carta.",
  12: "Se repite el juego del limón (como en el 6): arranca en \"un limón, medio limón, tres limones\" y sigue sumando de a uno hacia la derecha. Quien se traba, se come la carta.",
};

const ORO_OVERRIDES = {
  1: "Te la comés vos mismo, pero el castigo se cumple doble.",
};

function cardKey(suit, value) {
  return `${suit}-${value}`;
}

function buildDefaultDescriptions() {
  const result = {};
  for (const suit of SUITS) for (const value of VALUES) {
    result[cardKey(suit, value)] = (suit === "oro" && ORO_OVERRIDES[value]) || BASE_DESCRIPTIONS[value];
  }
  return result;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) for (const value of VALUES) deck.push({ suit, value });
  return shuffle(deck);
}

function createConfig() {
  return { descriptions: buildDefaultDescriptions(), turnOrder: [], showScoreToPlayers: false };
}

// El anfitrión puede reordenar el turno (config.turnOrder) desde el lobby.
// El orden efectivo siempre se recalcula en vivo: respeta ese orden guardado
// pero agrega al final a cualquier jugador que no figure en él (recién unido)
// y descarta ids que ya no están en la sala (expulsados).
function getOrder(room) {
  const ids = room.players.map(p => p.id);
  const stored = (room.config.turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !stored.includes(id));
  return [...stored, ...missing];
}

function nextTurnId(room, currentId) {
  const order = getOrder(room);
  const idx = order.indexOf(currentId);
  if (idx === -1) return order[0];
  return order[(idx + 1) % order.length];
}

function startRound(room) {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  room.round = {
    deck: buildDeck(),
    current: null, // { suit, value } carta revelada esperando asignación
    turnId: getOrder(room)[0],
    piles: {},
    history: [], // [{ suit, value, eatenBy }]
    endVotes: [], // ids que votaron terminar la partida antes de vaciar el mazo
  };
  room.phase = "round";
  return { success: true };
}

function handleAction(room, playerId, action, payload) {
  const round = room.round;
  switch (action) {
    case "reveal": {
      if (!round || room.phase !== "round") return { handled: false };
      if (round.current) return { handled: false };
      if (round.turnId !== playerId) return { handled: false };
      if (round.deck.length === 0) return { handled: false };
      round.current = round.deck.pop();
      return { handled: true };
    }

    case "assign": {
      if (!round || room.phase !== "round") return { handled: false };
      if (!round.current) return { handled: false };
      if (round.turnId !== playerId) return { handled: false };
      const targetId = payload?.targetId;
      if (!room.players.some(p => p.id === targetId)) return { handled: false };

      round.piles[targetId] = round.piles[targetId] || [];
      round.piles[targetId].push(round.current);
      round.history.push({ ...round.current, eatenBy: targetId });

      const finishedTurnId = round.turnId;
      round.current = null;
      if (round.deck.length === 0) {
        room.phase = "result";
      } else {
        round.turnId = nextTurnId(room, finishedTurnId);
      }
      return { handled: true };
    }

    // Cualquiera puede votar terminar la partida antes de vaciar el mazo —
    // con la mitad (redondeando para arriba) de los jugadores de la sala,
    // el fin de la ronda se anuncia usando la mesa tal cual está en ese
    // momento (mismo camino que "se acabó el mazo").
    case "vote_end": {
      if (!round || room.phase !== "round") return { handled: false };
      if (!round.endVotes.includes(playerId)) round.endVotes.push(playerId);
      const threshold = Math.ceil(room.players.length / 2);
      if (round.endVotes.length >= threshold) room.phase = "result";
      return { handled: true };
    }

    case "edit_descriptions": {
      if (playerId !== room.hostId) return { handled: false };
      const descriptions = payload?.descriptions;
      if (!descriptions || typeof descriptions !== "object") return { handled: false };
      room.config.descriptions = { ...room.config.descriptions, ...descriptions };
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function maybeAdvance() {
  // No hay condición de auto-avance: cada carta se resuelve con "assign".
}

function getPublicRoundView(room) {
  if (!room.round) return null;
  const round = room.round;
  const pileCounts = {};
  room.players.forEach(p => { pileCounts[p.id] = (round.piles[p.id] || []).length; });
  return {
    remaining: round.deck.length,
    current: round.current,
    turnId: round.turnId,
    order: getOrder(room),
    pileCounts,
    history: round.history,
    endVotes: round.endVotes,
    endVoteThreshold: Math.ceil(room.players.length / 2),
  };
}

function getPrivateView() {
  return null;
}

function getRevealMessage() {
  return null;
}

module.exports = {
  id: "limon-limon",
  minPlayers: MIN_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getRevealMessage,
};
