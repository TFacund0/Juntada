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

import type { Room } from "@juntada/shared-types";
import type { GameEngine } from "../engineTypes";

const MIN_PLAYERS = 2;

const SUITS = ["oro", "copa", "espada", "basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

interface Card {
  suit: string;
  value: number;
}

interface LimonLimonConfig {
  descriptions: Record<string, string>;
  turnOrder: string[];
  showScoreToPlayers: boolean;
  [key: string]: unknown;
}

interface LimonLimonRound {
  deck: Card[];
  current: Card | null;
  turnId: string;
  piles: Record<string, Card[]>;
  history: (Card & { eatenBy: string })[];
  endVotes: string[];
}

function cfg(room: Room): LimonLimonConfig {
  return room.config as LimonLimonConfig;
}

function round(room: Room): LimonLimonRound {
  return room.round as LimonLimonRound;
}

// Cada carta (número + palo) es una combinación distinta y puede tener su
// propio significado — pero las reglas son las mismas en los 4 palos, con
// una sola excepción: el 1 de oro duplica el castigo, mientras que el 1 de
// copa/espada/basto es un castigo simple (todas se pueden editar por
// separado desde el ConfigPanel, vía el "update_config" genérico).
const BASE_DESCRIPTIONS: Record<number, string> = {
  1: "Te la comés vos mismo.",
  2: "Come la carta el jugador a la derecha de quien la reveló.",
  3: "Quien reveló la carta elige quién se la come.",
  4: "Cuenten cuatro jugadores a la derecha empezando por quien reveló (que cuenta como el primero): el cuarto se la come.",
  5: "Elijan un tema (por ejemplo, selecciones de fútbol) y vayan diciendo uno por turno; quien se traba o repite, se come la carta.",
  6: 'Juego del limón: quien reveló dice "un limón, medio limón, tres limones" y el turno salta a la tercera persona a la derecha. Desde ahí, cada uno suma uno a la frase ("tres limones, medio limón, cuatro limones", después "cuatro... cinco", etc.) pasando siempre hacia la derecha. Quien se traba, se come la carta.',
  7: "Todos se tocan la nariz a la vez — el último en tocársela se come la carta.",
  10: "Elijan un tema nuevo y vayan diciendo uno por turno, como en el 5; quien se traba, se come la carta.",
  11: 'Palito: quien reveló dice "palito", el de la derecha "palito, palito", el siguiente "palito, palito, palito", sumando uno cada vez. Quien se confunde, se come la carta.',
  12: 'Se repite el juego del limón (como en el 6): arranca en "un limón, medio limón, tres limones" y sigue sumando de a uno hacia la derecha. Quien se traba, se come la carta.',
};

const ORO_OVERRIDES: Record<number, string> = {
  1: "Te la comés vos mismo, pero el castigo se cumple doble.",
};

function cardKey(suit: string, value: number): string {
  return `${suit}-${value}`;
}

function buildDefaultDescriptions(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const suit of SUITS)
    for (const value of VALUES) {
      result[cardKey(suit, value)] = (suit === "oro" && ORO_OVERRIDES[value]) || BASE_DESCRIPTIONS[value];
    }
  return result;
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const value of VALUES) deck.push({ suit, value });
  return shuffle(deck);
}

function createConfig(): LimonLimonConfig {
  return { descriptions: buildDefaultDescriptions(), turnOrder: [], showScoreToPlayers: false };
}

// El anfitrión puede reordenar el turno (config.turnOrder) desde el lobby.
// El orden efectivo siempre se recalcula en vivo: respeta ese orden guardado
// pero agrega al final a cualquier jugador que no figure en él (recién unido)
// y descarta ids que ya no están en la sala (expulsados).
function getOrder(room: Room): string[] {
  const ids = room.players.map(p => p.id);
  const stored = (cfg(room).turnOrder || []).filter(id => ids.includes(id));
  const missing = ids.filter(id => !stored.includes(id));
  return [...stored, ...missing];
}

function nextTurnId(room: Room, currentId: string): string {
  const order = getOrder(room);
  const idx = order.indexOf(currentId);
  if (idx === -1) return order[0];
  return order[(idx + 1) % order.length];
}

// El umbral de "terminar antes" se mide sobre los jugadores online: si se
// contaran los desconectados, un grupo donde más de la mitad se cayó no
// podría juntar nunca los votos para cortar la partida. Los votos de
// jugadores que ya no están en la sala (expulsados) también se descartan acá
// en vez de guardarse limpios, así el conteo nunca queda desincronizado.
function endVoteStatus(room: Room): { votes: string[]; threshold: number } {
  const activeIds = room.players.map(p => p.id);
  const votes = ((room.round as LimonLimonRound | null)?.endVotes || []).filter(id => activeIds.includes(id));
  const online = room.players.filter(p => p.online).length;
  const threshold = Math.max(1, Math.ceil(online / 2));
  return { votes, threshold };
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  room.round = {
    deck: buildDeck(),
    current: null, // { suit, value } carta revelada esperando asignación
    turnId: getOrder(room)[0],
    piles: {},
    history: [], // [{ suit, value, eatenBy }]
    endVotes: [], // ids que votaron terminar la partida antes de vaciar el mazo
  } satisfies LimonLimonRound;
  room.phase = "round";
  return { success: true };
}

function handleAction(room: Room, playerId: string, action: string, payload: Record<string, unknown>): { handled: boolean } {
  const r = room.round ? round(room) : null;
  switch (action) {
    case "reveal": {
      if (!r || room.phase !== "round") return { handled: false };
      if (r.current) return { handled: false };
      if (r.turnId !== playerId) return { handled: false };
      if (r.deck.length === 0) return { handled: false };
      r.current = r.deck.pop() ?? null;
      return { handled: true };
    }

    case "assign": {
      if (!r || room.phase !== "round") return { handled: false };
      if (!r.current) return { handled: false };
      if (r.turnId !== playerId) return { handled: false };
      const targetId = payload?.targetId as string;
      if (!room.players.some(p => p.id === targetId)) return { handled: false };

      r.piles[targetId] = r.piles[targetId] || [];
      r.piles[targetId].push(r.current);
      r.history.push({ ...r.current, eatenBy: targetId });

      const finishedTurnId = r.turnId;
      r.current = null;
      if (r.deck.length === 0) {
        room.phase = "result";
      } else {
        r.turnId = nextTurnId(room, finishedTurnId);
      }
      return { handled: true };
    }

    // Cualquiera puede votar terminar la partida antes de vaciar el mazo —
    // con la mitad (redondeando para arriba) de los jugadores online, el fin
    // de la ronda se anuncia usando la mesa tal cual está en ese momento
    // (mismo camino que "se acabó el mazo"). Si quedaba una carta revelada
    // sin repartir todavía (round.current), se deja tal cual: la vista de
    // resultado la muestra aparte, marcada como no repartida, en vez de
    // perderla en silencio.
    case "vote_end": {
      if (!r || room.phase !== "round") return { handled: false };
      if (!r.endVotes.includes(playerId)) r.endVotes.push(playerId);
      const { votes, threshold } = endVoteStatus(room);
      if (votes.length >= threshold) room.phase = "result";
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}

function maybeAdvance(): void {
  // No hay condición de auto-avance: cada carta se resuelve con "assign".
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const r = round(room);
  const pileCounts: Record<string, number> = {};
  room.players.forEach(p => {
    pileCounts[p.id] = (r.piles[p.id] || []).length;
  });
  const { votes, threshold } = endVoteStatus(room);
  return {
    remaining: r.deck.length,
    current: r.current,
    turnId: r.turnId,
    order: getOrder(room),
    pileCounts,
    history: r.history,
    endVotes: votes,
    endVoteThreshold: threshold,
  };
}

function getPrivateView(): null {
  return null;
}

function getRevealMessage(): null {
  return null;
}

const engine: GameEngine = {
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

module.exports = engine;
