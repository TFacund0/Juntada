// ─── Riel Salvaje — Game Engine (online) ────────────────────────────────────
// Wrapper fino sobre el motor puro de ./rules.ts (Fase 1 del PLAN.md) —
// ninguna regla del juego vive acá, solo el contrato GameEngine (registry.ts)
// y qué parte del estado es pública vs. privada por jugador.
//
// A diferencia de recamara/engine.ts, acá no hace falta un seatOrder que
// traduzca ids: rules.ts ya usa directamente los ids de jugador de la sala
// (room.players[].id) como Player.id, así que playerId viaja igual de un
// lado al otro.
//
// Selección de personaje: por ahora se asigna al azar en startRound (no hay
// UI de lobby para elegir todavía, ver DESIGN.md sección 3 y PLAN.md Fase 3)
// — cuando el frontend sume esa pantalla, esto puede cambiar a leer una
// elección ya guardada en room.config en vez de sortear.
import type { Room } from "@juntada/shared-types";
import { shuffle } from "@juntada/core-utils";
import type { GameEngine } from "../engineTypes";
import {
  actionPhaseComplete,
  computeFinalScores,
  currentPlanningPlayerId,
  currentRoundCard,
  createInitialState,
  drawThreeInsteadOfPlaying,
  finishRound,
  playPlanningCard,
  resolveNextAction,
  resolveRoundEvent,
  type ActionCardPayload,
  type FinalScore,
} from "./rules";
import { CHARACTER_IDS } from "./types";
import type { CargoItem, GameState, PlannedCard, Wagon } from "./types";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
// ASUNCIÓN: no viene de DESIGN.md — tiempo por turno de Planificación antes
// de que se juegue una carta al azar de la mano del jugador en su lugar.
// Ajustable si en la práctica se siente muy corto/largo.
const PLANNING_TURN_MS = 25_000;

interface RielSalvajeRound {
  state: GameState;
  // Cuándo se agota el turno de Planificación actual (null si no hay turno
  // de Planificación en curso — fase Acción, o partida terminada). Mismo
  // mecanismo genérico de auto-avance que usa rayado-libre (ver
  // getPhaseTimerEnd/forceReadyAndAdvance más abajo): el turno de acá no
  // corresponde 1:1 a `room.phase` (que se queda en "playing" toda la
  // partida), así que este campo se recalcula turno a turno.
  turnTimerEnd: number | null;
}

function round(room: Room): RielSalvajeRound {
  return room.round as RielSalvajeRound;
}

// Recalcula el vencimiento del turno de Planificación actual — se llama
// después de CUALQUIER acción que pueda haber cambiado a quién le toca (jugar
// una carta, robar 3, o el auto-avance del propio timer), y también al
// arrancar una ronda nueva. `null` en cuanto no hay a quién cronometrar
// (fase Acción, o la partida ya terminó).
function syncTurnTimer(r: RielSalvajeRound): void {
  r.turnTimerEnd = r.state.round.phase === "planning" && r.state.stage !== "finished" ? Date.now() + PLANNING_TURN_MS : null;
}

function createConfig(): Record<string, unknown> {
  return {};
}

function startRound(room: Room): { success?: true; error?: string } {
  if (room.players.length < MIN_PLAYERS) return { error: `Se necesitan al menos ${MIN_PLAYERS} jugadores` };
  if (room.players.length > MAX_PLAYERS) return { error: `Como máximo ${MAX_PLAYERS} jugadores` };

  const characters = shuffle(CHARACTER_IDS).slice(0, room.players.length);
  const playerSetups = room.players.map((p, i) => ({ id: p.id, character: characters[i] }));

  const r: RielSalvajeRound = { state: createInitialState(playerSetups), turnTimerEnd: null };
  syncTurnTimer(r);
  room.round = r;
  room.phase = "playing";
  return { success: true };
}

// Nada que auto-avanzar por tick genérico — el único auto-avance de este
// juego es el timer de turno de Planificación, manejado por
// getPhaseTimerEnd/forceReadyAndAdvance. El cierre de ronda/partida se
// dispara en handleAction en el momento en que se resuelve la última carta
// de Acción.
function maybeAdvance(_room: Room): void {}

// Cuando se agota el tiempo del turno de Planificación de alguien, se le
// juega una carta al azar de su propia mano en su lugar (a pedido del
// usuario) — nunca roba 3 automáticamente, salvo el caso límite de que ya
// no tenga ninguna carta en mano (no debería pasar en la práctica dado el
// tamaño de mano vs. turnos por carta de ronda, pero no truena si pasa).
function forceReadyAndAdvance(room: Room): void {
  if (!room.round || room.phase !== "playing") return;
  const r = round(room);
  if (r.state.round.phase !== "planning") return;
  const playerId = currentPlanningPlayerId(r.state);
  if (!playerId) return;
  const player = r.state.players.find(p => p.id === playerId);
  if (!player) return;

  if (player.hand.length === 0) {
    const res = drawThreeInsteadOfPlaying(r.state, playerId);
    if (!res.error) r.state = res.state;
  } else {
    const randomCard = player.hand[Math.floor(Math.random() * player.hand.length)];
    const res = playPlanningCard(r.state, playerId, randomCard.id);
    if (!res.error) r.state = res.state;
  }
  advanceIfActionComplete(room, r);
  syncTurnTimer(r);
}

function getPhaseTimerEnd(room: Room): number | null {
  if (!room.round || room.phase !== "playing") return null;
  return round(room).turnTimerEnd;
}

// Si la fase Acción queda con nada (o nada más) por resolver — incluido el
// caso límite de una pila completamente vacía, cuando todos robaron en vez
// de jugar durante Planificación, sin una sola carta que dispare esto desde
// resolve_card — hay que cerrar la ronda acá mismo: de lo contrario el
// juego queda trabado en "action" para siempre, esperando una carta que
// nunca va a llegar.
function advanceIfActionComplete(room: Room, r: RielSalvajeRound): void {
  if (r.state.round.phase !== "action" || !actionPhaseComplete(r.state)) return;
  r.state = resolveRoundEvent(r.state);
  r.state = finishRound(r.state);
  room.phase = r.state.stage === "finished" ? "result" : "playing";
}

// Las 3 acciones de abajo siempre cambian el estado privado de alguien (la
// mano del jugador que jugó/robó, o qué cartas boca abajo ya se resolvieron
// y cuáles siguen ocultas) — `rerolled: true` es lo que le dice al handler
// genérico de WS (ver roomHandlers.gameAction) que tiene que reenviarle a
// CADA jugador su private_role actualizado, no solo el "state" público.
// Sin esto, la mano que ve el cliente queda vieja apenas juega su primera
// carta, y termina mandando un cardId que ya no está en su mano.

function handlePlayCard(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: boolean } {
  const r = round(room);
  if (r.state.round.phase !== "planning") return { handled: false };
  const cardId = payload.cardId;
  if (typeof cardId !== "string") return { handled: false };
  const res = playPlanningCard(r.state, playerId, cardId);
  if (res.error) return { handled: false };
  r.state = res.state;
  advanceIfActionComplete(room, r);
  syncTurnTimer(r);
  return { handled: true, rerolled: true };
}

function handleDrawThree(room: Room, playerId: string): { handled: boolean; rerolled?: boolean } {
  const r = round(room);
  if (r.state.round.phase !== "planning") return { handled: false };
  const res = drawThreeInsteadOfPlaying(r.state, playerId);
  if (res.error) return { handled: false };
  r.state = res.state;
  advanceIfActionComplete(room, r);
  syncTurnTimer(r);
  return { handled: true, rerolled: true };
}

function handleResolveCard(room: Room, playerId: string, payload: Record<string, unknown>): { handled: boolean; rerolled?: boolean } {
  const r = round(room);
  if (r.state.round.phase !== "action") return { handled: false };
  const entry = r.state.round.stack[r.state.round.actionCursor];
  if (!entry || entry.ownerId !== playerId) return { handled: false };

  const actionPayload: ActionCardPayload = {
    direction: payload.direction === 1 || payload.direction === -1 ? payload.direction : undefined,
    distance: typeof payload.distance === "number" ? payload.distance : undefined,
    targetId: typeof payload.targetId === "string" ? payload.targetId : undefined,
    itemId: typeof payload.itemId === "string" ? payload.itemId : undefined,
    pushDirection: payload.pushDirection === 1 || payload.pushDirection === -1 ? payload.pushDirection : undefined,
  };
  const res = resolveNextAction(r.state, actionPayload);
  if (res.error) return { handled: false };
  r.state = res.state;
  advanceIfActionComplete(room, r);
  // Si esto cerró la ronda y la siguiente ya arrancó en Planificación (o
  // terminó la partida), el timer de turno tiene que reflejarlo.
  syncTurnTimer(r);
  return { handled: true, rerolled: true };
}

function handleAction(
  room: Room,
  playerId: string,
  action: string,
  payload: Record<string, unknown>,
): { handled: boolean; rerolled?: boolean } {
  if (!room.round || room.phase !== "playing") return { handled: false };
  switch (action) {
    case "play_card":
      return handlePlayCard(room, playerId, payload);
    case "draw_three":
      return handleDrawThree(room, playerId);
    case "resolve_card":
      return handleResolveCard(room, playerId, payload);
    default:
      return { handled: false };
  }
}

// ─── Vistas pública/privada ──────────────────────────────────────────────────
// Tabla de qué campo ve quién (PLAN.md Fase 2):
// - Posición, personaje, cantidad de cartas en mano/mazo: público.
// - Contenido real de la mano y del mazo propio: privado (getPrivateView).
// - Kind de una ficha de botín (bolsa/joya/maletín): público (se ve que
//   alguien tiene 3 ítems y de qué tipo). El VALOR real de una bolsa: solo
//   el dueño lo ve, salvo al terminar la partida (DESIGN.md 2).
// - Cartas apiladas boca arriba en la pila de la ronda: públicas apenas se
//   juegan. Las boca abajo (Túnel): ocultas para todos salvo su dueño hasta
//   que la fase Acción las resuelve (actionCursor las pasa).
interface PublicCargoItem {
  id: string;
  kind: CargoItem["kind"];
  value: number | null;
}

function publicCargo(items: CargoItem[], revealAll: boolean): PublicCargoItem[] {
  return items.map(i => ({ id: i.id, kind: i.kind, value: revealAll ? i.value : null }));
}

function publicWagon(w: Wagon, revealAll: boolean) {
  return {
    index: w.index,
    isLocomotora: w.isLocomotora,
    interior: { occupantIds: w.interior.occupantIds, items: publicCargo(w.interior.items, revealAll) },
    techo: { occupantIds: w.techo.occupantIds, items: publicCargo(w.techo.items, revealAll) },
  };
}

interface PublicStackEntry {
  ownerId: string;
  faceDown: boolean;
  kind: PlannedCard["card"]["kind"] | null;
}

function publicStackEntry(entry: PlannedCard, index: number, actionCursor: number, phase: string): PublicStackEntry {
  // Una carta boca abajo solo se revela al público una vez que la fase
  // Acción ya la resolvió (index < actionCursor) — mientras tanto nadie más
  // que su dueño sabe qué es (ver getPrivateView).
  const alreadyResolved = phase === "action" && index < actionCursor;
  const visible = !entry.faceDown || alreadyResolved;
  return { ownerId: entry.ownerId, faceDown: entry.faceDown, kind: visible ? entry.card.kind : null };
}

function getPublicRoundView(room: Room): Record<string, unknown> | null {
  if (!room.round) return null;
  const { state, turnTimerEnd } = round(room);
  const revealAll = state.stage === "finished";

  const players = state.players.map(p => ({
    id: p.id,
    character: p.character,
    position: p.position,
    handSize: p.hand.length,
    drawPileSize: p.drawPile.length,
    cargo: publicCargo(p.cargo, revealAll),
    ownBulletStock: p.ownBulletStock,
    bulletsReceivedTotal: p.bulletsReceivedTotal,
  }));

  return {
    train: state.train.map(w => publicWagon(w, revealAll)),
    marshal: state.marshal,
    players,
    sharedNeutralBulletsRemaining: state.sharedNeutralBulletsRemaining,
    secondBriefcasePlaced: state.secondBriefcasePlaced,
    round: {
      roundNumber: state.round.roundNumber,
      cardId: state.round.cardId,
      event: currentRoundCard(state).event,
      turns: currentRoundCard(state).turns,
      phase: state.round.phase,
      turnOrder: state.round.turnOrder,
      currentPlayerId: currentPlanningPlayerId(state),
      turnsCompleted: state.round.turnsCompleted,
      stack: state.round.stack.map((entry, i) => publicStackEntry(entry, i, state.round.actionCursor, state.round.phase)),
      actionCursor: state.round.actionCursor,
      // Cuándo se agota el turno de Planificación actual — null fuera de esa
      // fase. El frontend lo pasa tal cual a un <Timer timerEnd={...}/>
      // (mismo patrón que rayado-libre).
      planningTurnTimerEnd: turnTimerEnd,
    },
    stage: state.stage,
    pistoleroWinnerIds: state.pistoleroWinnerIds,
    winnerIds: state.winnerIds,
    finalScores: state.stage === "finished" ? computeFinalScores(state) : null,
  };
}

// Lo único que nunca debe viajar a nadie más que al propio jugador: el
// contenido real de su mano/mazo, el valor real de su propio botín, y el
// kind real de sus propias cartas boca abajo todavía sin resolver en la
// pila (ya visibles para él mismo, ocultas para el resto vía
// publicStackEntry de arriba).
function getPrivateView(room: Room, playerId: string): Record<string, unknown> | null {
  if (!room.round) return null;
  const { state } = round(room);
  const player = state.players.find(p => p.id === playerId);
  if (!player) return null;

  const ownFaceDownStack = state.round.stack
    .map((entry, i) => ({ entry, i }))
    .filter(({ entry, i }) => entry.ownerId === playerId && entry.faceDown && i >= state.round.actionCursor)
    .map(({ entry, i }) => ({ index: i, kind: entry.card.kind }));

  return {
    hand: player.hand,
    cargoValues: player.cargo.map(i => ({ id: i.id, value: i.value })),
    ownFaceDownStack,
  };
}

const engine: GameEngine = {
  id: "riel-salvaje",
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  createConfig,
  startRound,
  maybeAdvance,
  handleAction,
  getPublicRoundView,
  getPrivateView,
  getPhaseTimerEnd,
  forceReadyAndAdvance,
};

module.exports = engine;
