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
import type { Card } from "@juntada/limon-limon-deck";

const { buildDefaultDescriptions, orderedDeck } = require("@juntada/limon-limon-deck") as typeof import("@juntada/limon-limon-deck");
const { shuffle } = require("@juntada/core-utils");

const MIN_PLAYERS = 2;

interface LimonLimonConfig {
  descriptions: Record<string, string>;
  turnOrder: string[];
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

function buildDeck(): Card[] {
  return shuffle(orderedDeck());
}

function createConfig(): LimonLimonConfig {
  return { descriptions: buildDefaultDescriptions(), turnOrder: [] };
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

// Reveal/assign both require the current turn holder's own device (r.turnId
// === playerId) — if that specific player goes offline, nobody else can ever
// submit either action, and the round stalls forever waiting on a turn that
// may never come back (worse yet if they're later auto-kicked entirely: kept
// as-is, r.turnId would point at a player id that no longer even exists in
// room.players). So as soon as an offline player is up, hand the turn to the
// next player who's actually online — same idea as impostor's
// skipOfflineTurns. If they reconnect, the circular order still comes back
// around to them on a later lap; nothing here removes them from it.
function maybeAdvance(room: Room): void {
  if (!room.round || room.phase !== "round") return;
  const r = round(room);
  const order = getOrder(room);
  if (order.length === 0) return;
  const online = room.players.filter(p => p.online);
  if (online.length === 0) return;

  let turnId = r.turnId;
  for (let i = 0; i < order.length && !room.players.find(p => p.id === turnId)?.online; i++) {
    turnId = nextTurnId(room, turnId);
  }
  r.turnId = turnId;
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
  // maybeAdvance here is entirely turn-skip (no vote/ready count to protect
  // from a premature exclusion), so it's safe to also run it immediately on
  // disconnect instead of waiting out the 10-minute auto-kick grace period —
  // same reasoning as impostor's onPlayerOffline.
  onPlayerOffline: maybeAdvance,
};

module.exports = engine;
