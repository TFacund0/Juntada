// ═══════════════════════════════════════════════════════════════════════════
// RIEL SALVAJE — motor de reglas puro (Fase 1 del PLAN.md). Funciones que
// reciben estado + acción y devuelven estado nuevo, sin mutar el recibido —
// nada de red, nada de timers, 100% testeable con Jest (ver
// backend/test/rielSalvajeRules.test.ts). El wrapper de red
// (backend/src/games/riel-salvaje/engine.ts, contrato GameEngine) llega en
// Fase 2 y solo llama a estas funciones.
//
// Algunas cifras no vienen detalladas en DESIGN.md (el manual original no
// las especifica y no se guarda en este repo) — estas son decisiones propias
// para esta adaptación, marcadas explícitamente como ASUNCIÓN en el comentario
// de la constante correspondiente. Si jugando se sienten mal, se ajustan acá
// y se vuelcan a DESIGN.md (ver checklist transversal del PLAN).
// ═══════════════════════════════════════════════════════════════════════════

import { shuffle } from "@juntada/core-utils";
import type {
  ActionCard,
  ActionCardKind,
  BulletCard,
  CargoItem,
  CargoKind,
  CharacterId,
  DeckCard,
  GameState,
  Layer,
  Marshal,
  Player,
  PlannedCard,
  Position,
  RoundCardDef,
  RoundCardId,
  RoundEventId,
  RoundState,
  Train,
  TurnIcon,
  Wagon,
} from "./types";
import { CHARACTER_IDS } from "./types";

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Constantes de diseño ────────────────────────────────────────────────────

// ASUNCIÓN: el manual no detalla cuántas balas propias arranca teniendo cada
// jugador — 6 es un valor razonable (similar a la cantidad de acciones de
// disparo/golpe disponibles por partida) y se puede ajustar jugando.
export const STARTING_BULLET_STOCK = 6;
export const SHARED_NEUTRAL_BULLETS = 13;
export const STARTING_BAG_VALUE = 250;
export const JEWEL_VALUE = 500;
export const BRIEFCASE_VALUE = 1000;
export const TOTAL_BAGS = 18;
export const TOTAL_JEWELS = 6;
// ASUNCIÓN: DESIGN.md solo dice "valor entre $250 y $500" sin especificar
// la granularidad — acá se usan pasos de $50 (6 valores posibles), no
// cualquier entero del rango. Ajustable si se define algo más preciso.
const BAG_VALUE_OPTIONS = [250, 300, 350, 400, 450, 500];

// 10 cartas de acción por personaje (DESIGN.md 4.1): 2 Mover, 2 Cambiar de
// piso, 2 Disparar, 2 Robar, 1 Golpear, 1 Mover Marshal.
const ACTION_CARD_COUNTS: Record<ActionCardKind, number> = {
  mover: 2,
  cambiar_piso: 2,
  disparar: 2,
  robar: 2,
  golpear: 1,
  mover_marshal: 1,
};

export const HAND_SIZE = 6;
export const BUHO_HAND_SIZE = 7; // Búho roba 7 en vez de 6 (DESIGN.md 3)

// Las 7 cartas del mazo principal (rondas 1-4), layout exacto de
// DESIGN.md 4.4.1.
export const MAIN_ROUND_CARDS: Record<
  Exclude<RoundCardId, "carterismo" | "venganza_del_marshal" | "secuestro_del_conductor">,
  RoundCardDef
> = {
  marshal_furioso: {
    id: "marshal_furioso",
    turns: ["boca_arriba", "boca_arriba", "tunel", "cambio_de_via"],
    event: "marshal_furioso",
  },
  gancho_de_correo: {
    id: "gancho_de_correo",
    turns: ["boca_arriba", "tunel", "boca_arriba", "boca_arriba"],
    event: "brazo_giratorio",
  },
  freno: {
    id: "freno",
    turns: ["boca_arriba", "boca_arriba", "boca_arriba", "boca_arriba"],
    event: "frenada",
  },
  a_por_todas: {
    id: "a_por_todas",
    turns: ["boca_arriba", "tunel", "acelerar", "boca_arriba"],
    event: "llevatelo_todo",
  },
  rebelion_de_pasajeros: {
    id: "rebelion_de_pasajeros",
    turns: ["boca_arriba", "boca_arriba", "tunel", "boca_arriba", "boca_arriba"],
    event: "rebelion_de_pasajeros",
  },
  via_libre: {
    id: "via_libre",
    turns: ["boca_arriba", "tunel", "boca_arriba", "tunel"],
    event: null,
  },
  silbato_de_alarma: {
    id: "silbato_de_alarma",
    turns: ["boca_arriba", "boca_arriba", "acelerar", "tunel"],
    event: "alarma_en_el_tren",
  },
};

// Las 3 cartas de "Estación de tren" (ronda 5 — se sortea 1), mismo patrón
// de turnos, solo cambia el evento (DESIGN.md 4.4.1).
export const STATION_ROUND_CARDS: Record<"carterismo" | "venganza_del_marshal" | "secuestro_del_conductor", RoundCardDef> = {
  carterismo: {
    id: "carterismo",
    turns: ["boca_arriba", "boca_arriba", "tunel", "boca_arriba"],
    event: "carterismo",
  },
  venganza_del_marshal: {
    id: "venganza_del_marshal",
    turns: ["boca_arriba", "boca_arriba", "tunel", "boca_arriba"],
    event: "venganza_del_marshal",
  },
  secuestro_del_conductor: {
    id: "secuestro_del_conductor",
    turns: ["boca_arriba", "boca_arriba", "tunel", "boca_arriba"],
    event: "secuestro_del_conductor",
  },
};

export const ROUND_CARD_DEFS: Record<RoundCardId, RoundCardDef> = {
  ...MAIN_ROUND_CARDS,
  ...STATION_ROUND_CARDS,
};

// ─── Construcción de mazo / tren / botín ────────────────────────────────────

function buildCharacterDeck(): DeckCard[] {
  const cards: ActionCard[] = [];
  (Object.keys(ACTION_CARD_COUNTS) as ActionCardKind[]).forEach(kind => {
    for (let i = 0; i < ACTION_CARD_COUNTS[kind]; i++) {
      cards.push({ id: makeId(kind), kind });
    }
  });
  return cards;
}

function emptySlot(): { occupantIds: string[]; items: CargoItem[] } {
  return { occupantIds: [], items: [] };
}

// Un vagón por jugador + la Locomotora (DESIGN.md 2: de 3 vagones+Locomotora
// hasta 6 vagones+Locomotora). Índice 0 es siempre la Locomotora.
export function buildTrain(playerCount: number): Train {
  const wagons: Wagon[] = [];
  for (let i = 0; i <= playerCount; i++) {
    wagons.push({ index: i, isLocomotora: i === 0, interior: emptySlot(), techo: emptySlot() });
  }
  return wagons;
}

function randomBagValue(): number {
  return BAG_VALUE_OPTIONS[Math.floor(Math.random() * BAG_VALUE_OPTIONS.length)];
}

// Cada vagón de carga (no la Locomotora) trae entre MIN_ITEMS_PER_WAGON y
// MAX_ITEMS_PER_WAGON bolsas/joyas en el piso del interior — no hace falta
// repartir las 18 bolsas + 6 joyas del pool entero cada partida: ese pool
// completo solo existe para tener variedad de valores para elegir, no un
// total que deba usarse siempre entero (decisión confirmada con el
// usuario). Con pocos jugadores (menos vagones de carga) sobran fichas sin
// usar esa partida; con muchos, puede que no alcance el pool y algún vagón
// quede con menos del mínimo — no debería pasar con 3-6 jugadores dado el
// tamaño del pool, pero no truena si pasa.
export const MIN_ITEMS_PER_WAGON = 2;
export const MAX_ITEMS_PER_WAGON = 5;

export function distributeCargo(train: Train): void {
  const cargoWagons = train.filter(w => !w.isLocomotora);
  const bags: CargoItem[] = Array.from({ length: TOTAL_BAGS }, () => ({
    id: makeId("bolsa"),
    kind: "bolsa" as CargoKind,
    value: randomBagValue(),
  }));
  const jewels: CargoItem[] = Array.from({ length: TOTAL_JEWELS }, () => ({
    id: makeId("joya"),
    kind: "joya" as CargoKind,
    value: JEWEL_VALUE,
  }));
  const pool = shuffle([...bags, ...jewels]);
  let poolIndex = 0;
  for (const wagon of cargoWagons) {
    const count = MIN_ITEMS_PER_WAGON + Math.floor(Math.random() * (MAX_ITEMS_PER_WAGON - MIN_ITEMS_PER_WAGON + 1));
    for (let i = 0; i < count && poolIndex < pool.length; i++) {
      wagon.interior.items.push(pool[poolIndex]);
      poolIndex++;
    }
  }
  // El primer maletín arranca en la Locomotora junto al Marshal (DESIGN.md
  // 2) — el segundo se guarda aparte (GameState.secondBriefcasePlaced).
  train[0].interior.items.push({ id: makeId("maletin"), kind: "maletin", value: BRIEFCASE_VALUE });
}

// ─── Armado de partida ───────────────────────────────────────────────────────

export interface PlayerSetup {
  id: string;
  character: CharacterId;
}

// Sortea 4 cartas del mazo principal de 7 + 1 de "Estación de tren" para la
// 5ª ronda (DESIGN.md 4).
export function drawRoundCardOrder(): RoundCardId[] {
  const mainIds = Object.keys(MAIN_ROUND_CARDS) as RoundCardId[];
  const stationIds = Object.keys(STATION_ROUND_CARDS) as RoundCardId[];
  const main4 = shuffle(mainIds).slice(0, 4);
  const station1 = shuffle(stationIds)[0];
  return [...main4, station1];
}

export function createInitialState(playerSetups: readonly PlayerSetup[]): GameState {
  if (playerSetups.length < 3 || playerSetups.length > 6) {
    throw new Error("riel-salvaje: se necesitan entre 3 y 6 jugadores");
  }
  const usedCharacters = new Set(playerSetups.map(p => p.character));
  if (usedCharacters.size !== playerSetups.length) {
    throw new Error("riel-salvaje: no puede haber personajes repetidos");
  }

  const train = buildTrain(playerSetups.length);
  distributeCargo(train);

  // Todos arrancan en el INTERIOR de "su" vagón (el n-ésimo vagón detrás de
  // la Locomotora, en el orden en que se recibió playerSetups) — ninguno
  // arranca en la Locomotora ni en un techo.
  const players: Player[] = playerSetups.map((setup, i) => ({
    id: setup.id,
    character: setup.character,
    position: { wagonIndex: i + 1, layer: "interior" as Layer },
    hand: [],
    drawPile: shuffle(buildCharacterDeck()),
    discardPile: [],
    cargo: [{ id: makeId("bolsa_inicial"), kind: "bolsa", value: STARTING_BAG_VALUE }],
    bulletsReceivedTotal: 0,
    ownBulletStock: STARTING_BULLET_STOCK,
    sombraFirstTurnPlayed: false,
  }));
  players.forEach(p => {
    train[p.position.wagonIndex].interior.occupantIds.push(p.id);
  });

  const marshal: Marshal = { position: { wagonIndex: 0, layer: "interior" } };

  const roundCardOrder = drawRoundCardOrder();
  // Jugador Inicial de la 1ª ronda: sorteado al azar entre los personajes
  // elegidos (DESIGN.md 4).
  const firstPlayerId = shuffle(players.map(p => p.id))[0];

  const state: GameState = {
    train,
    marshal,
    players,
    sharedNeutralBulletsRemaining: SHARED_NEUTRAL_BULLETS,
    secondBriefcasePlaced: false,
    roundCardOrder,
    round: emptyRoundState(1, roundCardOrder[0], [firstPlayerId, ...players.map(p => p.id).filter(id => id !== firstPlayerId)]),
    stage: "planning",
    pistoleroWinnerIds: null,
    winnerIds: null,
  };
  return dealHands(state);
}

function emptyRoundState(roundNumber: 1 | 2 | 3 | 4 | 5, cardId: RoundCardId, turnOrder: string[]): RoundState {
  return {
    roundNumber,
    cardId,
    phase: "planning",
    turnOrder,
    currentPlayerIndex: 0,
    direction: 1,
    playsUsedThisTurn: 0,
    turnsCompleted: 0,
    stack: [],
    actionCursor: 0,
  };
}

function handSizeFor(player: Player): number {
  return player.character === "buho" ? BUHO_HAND_SIZE : HAND_SIZE;
}

// Mezcla mazo+descarte de cada jugador y reparte su mano — 6 cartas (7 para
// Búho, DESIGN.md 3). No muta `state`.
function dealHands(state: GameState): GameState {
  const players = state.players.map(p => {
    const pool = shuffle([...p.drawPile, ...p.discardPile]);
    const size = handSizeFor(p);
    return {
      ...p,
      hand: pool.slice(0, size),
      drawPile: pool.slice(size),
      discardPile: [],
      sombraFirstTurnPlayed: false,
    };
  });
  return { ...state, players };
}

// ─── Fase Planificación ──────────────────────────────────────────────────────

function clonePlayers(state: GameState): Player[] {
  return state.players.map(p => ({
    ...p,
    hand: [...p.hand],
    drawPile: [...p.drawPile],
    discardPile: [...p.discardPile],
    cargo: [...p.cargo],
  }));
}

function findPlayer(state: GameState, playerId: string): Player {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error(`riel-salvaje: no player with id ${playerId}`);
  return player;
}

export function currentRoundCard(state: GameState): RoundCardDef {
  return ROUND_CARD_DEFS[state.round.cardId];
}

// Ícono del turno de Planificación que está en curso ahora mismo.
export function currentTurnIcon(state: GameState): TurnIcon {
  const def = currentRoundCard(state);
  return def.turns[state.round.turnsCompleted];
}

export function planningComplete(state: GameState): boolean {
  return state.round.turnsCompleted >= currentRoundCard(state).turns.length;
}

export function currentPlanningPlayerId(state: GameState): string | null {
  if (planningComplete(state)) return null;
  return state.round.turnOrder[state.round.currentPlayerIndex];
}

// Reglas de Túnel y de Sombra sobre si esta carta se juega boca abajo.
//
// SIMPLIFICACIÓN (decisión consciente, confirmada con el usuario): DESIGN.md
// 3 dice que Sombra "PUEDE" jugar boca abajo en su primer turno — es
// opcional, no obligatorio. Acá se implementa como automático (siempre boca
// abajo si es su primer turno y decide jugar, no robar) porque en la
// práctica casi nunca conviene revelarla, y agregar una elección real
// requeriría un parámetro extra en play_card + UI dedicada para un caso de
// bajo impacto. Si esto se revisita, agregar un flag opcional a
// playPlanningCard en vez de este atajo.
function shouldPlayFaceDown(state: GameState, playerId: string, icon: TurnIcon): boolean {
  if (icon === "tunel") return true;
  // El primer turno de CUALQUIER jugador cae siempre en turnsCompleted===0 —
  // cada turno-ícono hace que todos los jugadores de turnOrder jueguen una
  // vez antes de pasar al siguiente ícono (ver advancePlanningTurn), así que
  // no hace falta comparar contra turnOrder[0] para saber si es su primera vez.
  const isFirstTurnOfRound = state.round.turnsCompleted === 0;
  const player = findPlayer(state, playerId);
  return player.character === "sombra" && !player.sombraFirstTurnPlayed && isFirstTurnOfRound;
}

function requiredPlaysForIcon(icon: TurnIcon): number {
  return icon === "acelerar" ? 2 : 1;
}

// Avanza el cursor de turno de Planificación tras UNA carta jugada por el
// jugador actual. "acelerar" pide 2 cartas seguidas del mismo jugador antes
// de pasar al siguiente (DESIGN.md 4.1); un turno-ícono termina recién
// cuando todos los jugadores de turnOrder jugaron para ese ícono (el índice
// vuelve a 0), momento en el que se pasa al ícono siguiente y, si ese
// próximo ícono es "cambio_de_via", el sentido pasa a antihorario desde ahí
// (arrancando, como siempre al volver a 0, por el Jugador Inicial).
function advancePlanningTurn(round: RoundState, icon: TurnIcon): RoundState {
  const playsUsedThisTurn = round.playsUsedThisTurn + 1;
  if (playsUsedThisTurn < requiredPlaysForIcon(icon)) {
    return { ...round, playsUsedThisTurn };
  }

  const nextIndex = (round.currentPlayerIndex + round.direction + round.turnOrder.length) % round.turnOrder.length;
  if (nextIndex !== 0) {
    return { ...round, currentPlayerIndex: nextIndex, playsUsedThisTurn: 0 };
  }

  const turnsCompleted = round.turnsCompleted + 1;
  if (turnsCompleted >= ROUND_CARD_DEFS[round.cardId].turns.length) {
    return { ...round, turnsCompleted, currentPlayerIndex: 0, playsUsedThisTurn: 0, phase: "action" };
  }
  const nextIcon = ROUND_CARD_DEFS[round.cardId].turns[turnsCompleted];
  const direction = nextIcon === "cambio_de_via" ? -1 : round.direction;
  return { ...round, turnsCompleted, currentPlayerIndex: 0, playsUsedThisTurn: 0, direction };
}

export interface PlanActionResult {
  state: GameState;
  error?: string;
}

// Un jugador apila 1 carta de su mano (o 2, si el turno es "acelerar" y ya
// jugó la primera) en el mazo combinado de la ronda.
export function playPlanningCard(state: GameState, playerId: string, cardId: string): PlanActionResult {
  if (state.round.phase !== "planning") return { state, error: "No es fase de Planificación" };
  if (currentPlanningPlayerId(state) !== playerId) return { state, error: "No es tu turno" };

  const icon = currentTurnIcon(state);
  const player = findPlayer(state, playerId);
  const card = player.hand.find(c => c.id === cardId);
  if (!card) return { state, error: "Esa carta no está en tu mano" };

  const faceDown = shouldPlayFaceDown(state, playerId, icon);
  const planned: PlannedCard = { card, faceDown, ownerId: playerId };

  const players = clonePlayers(state);
  const me = players.find(p => p.id === playerId)!;
  me.hand = me.hand.filter(c => c.id !== cardId);
  if (player.character === "sombra" && !player.sombraFirstTurnPlayed) me.sombraFirstTurnPlayed = true;

  const round = advancePlanningTurn({ ...state.round, stack: [...state.round.stack, planned] }, icon);

  return { state: { ...state, players, round } };
}

// Alternativa a jugar: robar 3 cartas nuevas del propio mazo (DESIGN.md
// 4.1). Cuenta como el turno completo aunque sea "acelerar" (no se roban 6).
export function drawThreeInsteadOfPlaying(state: GameState, playerId: string): PlanActionResult {
  if (state.round.phase !== "planning") return { state, error: "No es fase de Planificación" };
  if (currentPlanningPlayerId(state) !== playerId) return { state, error: "No es tu turno" };

  const player = findPlayer(state, playerId);
  const players = clonePlayers(state);
  const me = players.find(p => p.id === playerId)!;
  let pool = me.drawPile;
  if (pool.length < 3) pool = shuffle([...pool, ...me.discardPile]);
  me.hand = [...me.hand, ...pool.slice(0, 3)];
  me.drawPile = pool.slice(3);
  me.discardPile = pool.length === me.drawPile.length + 3 ? me.discardPile : [];
  // Sombra pierde la habilidad esa ronda si roba en vez de jugar en su
  // primer turno (DESIGN.md 3).
  if (player.character === "sombra" && !player.sombraFirstTurnPlayed) me.sombraFirstTurnPlayed = true;

  // Robar 3 cuenta como el turno completo aunque el ícono sea "acelerar" —
  // nunca se roban 6 (DESIGN.md 4.1).
  const round = advancePlanningTurn(
    { ...state.round, playsUsedThisTurn: requiredPlaysForIcon(currentTurnIcon(state)) - 1 },
    currentTurnIcon(state),
  );
  return { state: { ...state, players, round } };
}

// ─── Movimiento (helper compartido) ──────────────────────────────────────────

// Único helper de "mover N vagones, clampeado a los extremos" — nunca se
// abandona el tren (DESIGN.md 4.3), lo reusan disparo de Trueno, empujón de
// puñetazo y eventos de fin de ronda.
export function clampWagonMove(train: Train, fromWagon: number, delta: number): number {
  return Math.max(0, Math.min(train.length - 1, fromWagon + delta));
}

function moveOccupant(train: Train, playerId: string, from: Position, to: Position): Train {
  const next = train.map(w => ({
    ...w,
    interior: { ...w.interior, occupantIds: [...w.interior.occupantIds] },
    techo: { ...w.techo, occupantIds: [...w.techo.occupantIds] },
  }));
  const fromSlot = from.layer === "interior" ? next[from.wagonIndex].interior : next[from.wagonIndex].techo;
  fromSlot.occupantIds = fromSlot.occupantIds.filter(id => id !== playerId);
  const toSlot = to.layer === "interior" ? next[to.wagonIndex].interior : next[to.wagonIndex].techo;
  toSlot.occupantIds.push(playerId);
  return next;
}

// Si el Marshal termina compartiendo vagón (interior) con bandidos, cada uno
// sube de inmediato al techo de ese vagón y recibe una bala neutral
// (DESIGN.md 2 y 4.6). Se llama después de CUALQUIER movimiento del Marshal
// o de un jugador hacia el interior del vagón del Marshal.
function resolveMarshalCollision(state: GameState): GameState {
  const marshalWagon = state.marshal.position.wagonIndex;
  const occupants = state.train[marshalWagon].interior.occupantIds;
  if (occupants.length === 0) return state;

  let train = state.train;
  let players = state.players;
  let sharedNeutralBulletsRemaining = state.sharedNeutralBulletsRemaining;
  const toPosition: Position = { wagonIndex: marshalWagon, layer: "techo" };
  occupants.forEach(playerId => {
    train = moveOccupant(train, playerId, { wagonIndex: marshalWagon, layer: "interior" }, toPosition);
    players = players.map(p => (p.id === playerId ? { ...p, position: toPosition } : p));
    const result = giveBullet(players, sharedNeutralBulletsRemaining, playerId, "neutral");
    players = result.players;
    sharedNeutralBulletsRemaining = result.sharedNeutralBulletsRemaining;
  });
  return { ...state, train, players, sharedNeutralBulletsRemaining };
}

// Entrega una BulletCard al descarte del objetivo (se mezcla en su mazo la
// próxima vez que reparta manos) — consume el mazo compartido si la fuente
// es "neutral" y ya está agotado (DESIGN.md 2: si se agota, no se entrega
// más por el resto de la partida).
function giveBullet(
  players: Player[],
  sharedNeutralBulletsRemaining: number,
  targetId: string,
  source: "neutral" | { shooterId: string },
): { players: Player[]; sharedNeutralBulletsRemaining: number } {
  if (source === "neutral" && sharedNeutralBulletsRemaining <= 0) return { players, sharedNeutralBulletsRemaining };
  const bullet: BulletCard = { id: makeId("bala"), kind: "bala", source };
  const nextPlayers = players.map(p => {
    if (p.id !== targetId) return p;
    // El desempate de fin de partida cuenta TODA bala recibida — de otro
    // jugador o de un evento/Marshal (DESIGN.md 4.5: "menos cartas de Bala
    // de otros jugadores Y DE EVENTOS") — nunca solo las de origen jugador.
    return { ...p, discardPile: [...p.discardPile, bullet], bulletsReceivedTotal: p.bulletsReceivedTotal + 1 };
  });
  return {
    players: nextPlayers,
    sharedNeutralBulletsRemaining: source === "neutral" ? sharedNeutralBulletsRemaining - 1 : sharedNeutralBulletsRemaining,
  };
}

// ─── Fase Acción — resolución de una carta a la vez ─────────────────────────

export interface ActionCardPayload {
  direction?: 1 | -1; // mover, mover_marshal
  // "mover" en el techo puede ser de varios vagones de una (DESIGN.md 4.1) —
  // ignorado en el interior (siempre 1) y en mover_marshal (siempre 1).
  distance?: number;
  targetId?: string; // disparar, golpear
  itemId?: string; // robar, golpear (qué ficha suelta la víctima)
  pushDirection?: 1 | -1; // golpear: a qué vagón adyacente empuja el atacante
}

export interface ResolveResult {
  state: GameState;
  error?: string;
}

function isDaliaProtected(state: GameState, targetId: string, candidateIds: string[]): boolean {
  const target = findPlayer(state, targetId);
  if (target.character !== "dalia") return false;
  // Dalia no puede ser objetivo si hay OTRO bandido elegible (DESIGN.md 3).
  return candidateIds.some(id => id !== targetId);
}

function playersInSameSlot(state: GameState, position: Position, excludeId?: string): string[] {
  const slot = position.layer === "interior" ? state.train[position.wagonIndex].interior : state.train[position.wagonIndex].techo;
  return slot.occupantIds.filter(id => id !== excludeId);
}

function applyMove(state: GameState, playerId: string, payload: ActionCardPayload): ResolveResult {
  const player = findPlayer(state, playerId);
  const direction = payload.direction ?? 1;
  // En el interior siempre es 1 vagón; en el techo puede ser varios de una
  // (DESIGN.md 4.1) — `distance` es la magnitud que pide el jugador,
  // clampeada a lo que el tren mide (clampWagonMove ya cubre "nunca se
  // abandona el tren" con el resultado final).
  const distance = player.position.layer === "techo" ? Math.max(1, Math.min(state.train.length - 1, payload.distance ?? 1)) : 1;
  const toWagon = clampWagonMove(state.train, player.position.wagonIndex, direction * distance);
  const to: Position = { wagonIndex: toWagon, layer: player.position.layer };
  const train = moveOccupant(state.train, playerId, player.position, to);
  const players = state.players.map(p => (p.id === playerId ? { ...p, position: to } : p));
  let next = { ...state, train, players };
  if (to.layer === "interior") next = resolveMarshalCollision(next);
  return { state: next };
}

function applyChangeLayer(state: GameState, playerId: string): ResolveResult {
  const player = findPlayer(state, playerId);
  const to: Position = { wagonIndex: player.position.wagonIndex, layer: player.position.layer === "interior" ? "techo" : "interior" };
  const train = moveOccupant(state.train, playerId, player.position, to);
  const players = state.players.map(p => (p.id === playerId ? { ...p, position: to } : p));
  let next = { ...state, train, players };
  if (to.layer === "interior") next = resolveMarshalCollision(next);
  return { state: next };
}

function applyMoveMarshal(state: GameState, payload: ActionCardPayload): ResolveResult {
  const direction = payload.direction ?? 1;
  const toWagon = clampWagonMove(state.train, state.marshal.position.wagonIndex, direction);
  const marshal: Marshal = { position: { wagonIndex: toWagon, layer: "interior" } };
  const next = resolveMarshalCollision({ ...state, marshal });
  return { state: next };
}

function applyRob(state: GameState, playerId: string, payload: ActionCardPayload): ResolveResult {
  const player = findPlayer(state, playerId);
  const slot =
    player.position.layer === "interior" ? state.train[player.position.wagonIndex].interior : state.train[player.position.wagonIndex].techo;
  const item = slot.items.find(i => i.id === payload.itemId) ?? slot.items[0];
  // Sin nada en el piso, "robar" no tiene efecto — ver nota equivalente en
  // applyShoot.
  if (!item) return { state };

  const train = state.train.map(w => ({
    ...w,
    interior: { ...w.interior, items: w.interior.items.filter(i => i.id !== item.id) },
    techo: { ...w.techo, items: w.techo.items.filter(i => i.id !== item.id) },
  }));
  const players = state.players.map(p => (p.id === playerId ? { ...p, cargo: [...p.cargo, item] } : p));
  return { state: { ...state, train, players } };
}

// Línea de visión desde el interior: solo el vagón adyacente. Desde el
// techo: cualquier vagón, pero bloqueada por el primer bandido en el medio
// en esa dirección (DESIGN.md 4.3). Devuelve los ids "alcanzables" (el más
// cercano bloquea a los de más allá), para que el llamador valide el target.
export function reachableShotTargets(state: GameState, shooterId: string): string[] {
  const shooter = findPlayer(state, shooterId);
  const baseTargets = (() => {
    if (shooter.position.layer === "interior") {
      return [-1, 1]
        .map(d => clampWagonMove(state.train, shooter.position.wagonIndex, d))
        .filter(w => w !== shooter.position.wagonIndex)
        .flatMap(w => playersInSameSlot(state, { wagonIndex: w, layer: "interior" }));
    }
    // Techo: recorre en ambas direcciones hasta encontrar el primer vagón con
    // gente en el techo (los de ahí "lado a lado" son todos alcanzables; más
    // allá queda bloqueado).
    const targets: string[] = [];
    for (const dir of [-1, 1] as const) {
      for (let w = shooter.position.wagonIndex + dir; w >= 0 && w < state.train.length; w += dir) {
        const occupants = playersInSameSlot(state, { wagonIndex: w, layer: "techo" });
        if (occupants.length > 0) {
          targets.push(...occupants);
          break;
        }
      }
    }
    return targets;
  })();

  // Víbora: único caso permitido de disparar dentro del propio vagón, a
  // través del techo, a otro piso (DESIGN.md 3).
  if (shooter.character === "vibora") {
    const otherLayer: Layer = shooter.position.layer === "interior" ? "techo" : "interior";
    return [...baseTargets, ...playersInSameSlot(state, { wagonIndex: shooter.position.wagonIndex, layer: otherLayer }, shooterId)];
  }
  return baseTargets;
}

function applyShoot(state: GameState, shooterId: string, payload: ActionCardPayload): ResolveResult {
  const shooter = findPlayer(state, shooterId);
  if (shooter.ownBulletStock <= 0) return { state };

  const candidates = reachableShotTargets(state, shooterId);
  // Sin nadie en rango, "disparar" no tiene efecto — no es un error del
  // jugador, solo un tiro sin nadie a quien apuntar (la acción "sigue siendo
  // legal" en el sentido de PLAN.md Fase 1, simplemente no hace nada).
  if (candidates.length === 0) return { state };
  if (!payload.targetId) return { state, error: "Falta el objetivo" };
  if (!candidates.includes(payload.targetId)) return { state, error: "Ese objetivo no es válido desde acá" };
  if (isDaliaProtected(state, payload.targetId, candidates))
    return { state, error: "Dalia no puede ser objetivo mientras haya otro válido" };

  const players1 = state.players.map(p => (p.id === shooterId ? { ...p, ownBulletStock: p.ownBulletStock - 1 } : p));
  const { players, sharedNeutralBulletsRemaining } = giveBullet(players1, state.sharedNeutralBulletsRemaining, payload.targetId, {
    shooterId,
  });
  let next: GameState = { ...state, players, sharedNeutralBulletsRemaining };

  // Trueno: el objetivo SIEMPRE retrocede 1 vagón al recibir el disparo — no
  // es opcional, solo la dirección es a elección de Trueno (DESIGN.md 3),
  // así que hace falta que la mande explícitamente en vez de asumir una.
  if (shooter.character === "trueno") {
    if (payload.direction !== 1 && payload.direction !== -1) {
      return { state: next, error: "Trueno tiene que elegir para qué lado empuja" };
    }
    const target = findPlayer(next, payload.targetId);
    const toWagon = clampWagonMove(next.train, target.position.wagonIndex, payload.direction);
    const to: Position = { wagonIndex: toWagon, layer: target.position.layer };
    const train = moveOccupant(next.train, payload.targetId, target.position, to);
    const movedPlayers = next.players.map(p => (p.id === payload.targetId ? { ...p, position: to } : p));
    next = { ...next, train, players: movedPlayers };
    if (to.layer === "interior") next = resolveMarshalCollision(next);
  }
  return { state: next };
}

function applyPunch(state: GameState, attackerId: string, payload: ActionCardPayload): ResolveResult {
  const attacker = findPlayer(state, attackerId);
  const candidates = playersInSameSlot(state, attacker.position, attackerId);
  // Sin nadie más en el mismo vagón y piso, "golpear" no tiene efecto — ver
  // nota equivalente en applyShoot.
  if (candidates.length === 0) return { state };
  if (!payload.targetId) return { state, error: "Falta el objetivo" };
  if (!candidates.includes(payload.targetId)) return { state, error: "Ese objetivo no está en tu mismo vagón y piso" };
  if (isDaliaProtected(state, payload.targetId, candidates))
    return { state, error: "Dalia no puede ser objetivo mientras haya otro válido" };
  // El empujón siempre pasa — el atacante elige a qué vagón adyacente
  // empuja a la víctima (DESIGN.md 4.3), así que la dirección tiene que
  // venir explícita en vez de asumir una por default.
  if (payload.pushDirection !== 1 && payload.pushDirection !== -1) {
    return { state, error: "Tenés que elegir para qué lado empujás a la víctima" };
  }

  const victim = findPlayer(state, payload.targetId);
  // El atacante elige qué ficha suelta la víctima (DESIGN.md 4.3); si no
  // llega itemId (víctima sin cargo) no suelta nada.
  const droppedItem = victim.cargo.find(i => i.id === payload.itemId);

  let players = state.players;
  let train = state.train;
  if (droppedItem) {
    players = players.map(p => (p.id === victim.id ? { ...p, cargo: p.cargo.filter(i => i.id !== droppedItem.id) } : p));
    // Urraca: si es una bolsa (no joya/maletín), la recoge de inmediato para
    // ella en vez de dejarla tirada (DESIGN.md 3).
    if (attacker.character === "urraca" && droppedItem.kind === "bolsa") {
      players = players.map(p => (p.id === attackerId ? { ...p, cargo: [...p.cargo, droppedItem] } : p));
    } else {
      train = train.map((w, i) =>
        i === victim.position.wagonIndex
          ? {
              ...w,
              interior: victim.position.layer === "interior" ? { ...w.interior, items: [...w.interior.items, droppedItem] } : w.interior,
              techo: victim.position.layer === "techo" ? { ...w.techo, items: [...w.techo.items, droppedItem] } : w.techo,
            }
          : w,
      );
    }
  }

  const toWagon = clampWagonMove(train, victim.position.wagonIndex, payload.pushDirection);
  const to: Position = { wagonIndex: toWagon, layer: victim.position.layer };
  train = moveOccupant(train, victim.id, victim.position, to);
  players = players.map(p => (p.id === victim.id ? { ...p, position: to } : p));

  let next: GameState = { ...state, train, players };
  if (to.layer === "interior") next = resolveMarshalCollision(next);
  return { state: next };
}

// Resuelve la próxima entrada de la pila de Acción (una carta), aplicando su
// efecto de inmediato. Las cartas de Bala (recibidas por disparos) no hacen
// nada al "jugarse" — ya cumplieron su función de ocupar un hueco del mazo.
export function resolveNextAction(state: GameState, payload: ActionCardPayload = {}): ResolveResult {
  if (state.round.phase !== "action") return { state, error: "No es fase de Acción" };
  const entry = state.round.stack[state.round.actionCursor];
  if (!entry) return { state, error: "No quedan cartas por resolver" };

  const round = { ...state.round, actionCursor: state.round.actionCursor + 1 };
  const base = { ...state, round };

  if (entry.card.kind === "bala") return { state: base };

  switch (entry.card.kind) {
    case "mover":
      return applyMove(base, entry.ownerId, payload);
    case "cambiar_piso":
      return applyChangeLayer(base, entry.ownerId);
    case "mover_marshal":
      return applyMoveMarshal(base, payload);
    case "robar":
      return applyRob(base, entry.ownerId, payload);
    case "disparar":
      return applyShoot(base, entry.ownerId, payload);
    case "golpear":
      return applyPunch(base, entry.ownerId, payload);
    default:
      return { state: base };
  }
}

export function actionPhaseComplete(state: GameState): boolean {
  return state.round.phase === "action" && state.round.actionCursor >= state.round.stack.length;
}

// ─── Eventos de fin de ronda ─────────────────────────────────────────────────

function wagonOf(train: Train, position: Position): Wagon {
  return train[position.wagonIndex];
}

export function resolveRoundEvent(state: GameState): GameState {
  const event: RoundEventId | null = currentRoundCard(state).event;
  if (!event) return state;

  let players = state.players;
  let train = state.train;
  let marshal = state.marshal;
  let sharedNeutralBulletsRemaining = state.sharedNeutralBulletsRemaining;
  let secondBriefcasePlaced = state.secondBriefcasePlaced;

  const bullet = (targetId: string) => {
    const result = giveBullet(players, sharedNeutralBulletsRemaining, targetId, "neutral");
    players = result.players;
    sharedNeutralBulletsRemaining = result.sharedNeutralBulletsRemaining;
  };

  switch (event) {
    case "marshal_furioso": {
      // Dispara a todos los del techo de su propio vagón, luego avanza
      // siempre hacia la cola (DESIGN.md 4.4 #1).
      playersInSameSlot({ ...state, players, train }, { wagonIndex: marshal.position.wagonIndex, layer: "techo" }).forEach(bullet);
      marshal = { position: { wagonIndex: clampWagonMove(train, marshal.position.wagonIndex, 1), layer: "interior" } };
      break;
    }
    case "brazo_giratorio": {
      // Todos los del techo van al techo del último vagón (DESIGN.md 4.4 #2).
      const lastWagon = train.length - 1;
      players.forEach(p => {
        if (p.position.layer === "techo" && p.position.wagonIndex !== lastWagon) {
          train = moveOccupant(train, p.id, p.position, { wagonIndex: lastWagon, layer: "techo" });
        }
      });
      players = players.map(p => (p.position.layer === "techo" ? { ...p, position: { wagonIndex: lastWagon, layer: "techo" } } : p));
      break;
    }
    case "frenada": {
      // Todos los del techo avanzan 1 vagón hacia la Locomotora (DESIGN.md
      // 4.4 #3).
      players.forEach(p => {
        if (p.position.layer !== "techo") return;
        const toWagon = clampWagonMove(train, p.position.wagonIndex, -1);
        train = moveOccupant(train, p.id, p.position, { wagonIndex: toWagon, layer: "techo" });
      });
      players = players.map(p =>
        p.position.layer === "techo"
          ? { ...p, position: { wagonIndex: clampWagonMove(train, p.position.wagonIndex, -1), layer: "techo" } }
          : p,
      );
      break;
    }
    case "llevatelo_todo": {
      // El segundo maletín entra en juego, en el vagón del Marshal
      // (DESIGN.md 2 y 4.4 #4).
      if (!secondBriefcasePlaced) {
        secondBriefcasePlaced = true;
        train = train.map((w, i) =>
          i === marshal.position.wagonIndex
            ? {
                ...w,
                interior: {
                  ...w.interior,
                  items: [...w.interior.items, { id: makeId("maletin"), kind: "maletin", value: BRIEFCASE_VALUE }],
                },
              }
            : w,
        );
      }
      break;
    }
    case "rebelion_de_pasajeros": {
      // Todos los del interior reciben bala neutral (DESIGN.md 4.4 #5).
      players.filter(p => p.position.layer === "interior").forEach(p => bullet(p.id));
      break;
    }
    case "carterismo": {
      // Cada bandido solo en su posición se lleva gratis una bolsa de dinero
      // ahí, si hay (DESIGN.md 4.4 #6) — no aplica a joyas ni maletines.
      //
      // SIMPLIFICACIÓN (decisión consciente, confirmada con el usuario):
      // DESIGN.md dice que el bandido "PUEDE tomar" la bolsa — es opcional.
      // Acá se toma automático para todos los elegibles: nadie rechazaría
      // plata gratis en la práctica, y una elección real necesitaría una
      // sub-fase nueva de confirmación antes de cerrar la ronda.
      players.forEach(p => {
        const others = playersInSameSlot({ ...state, players, train }, p.position, p.id);
        if (others.length > 0) return;
        const slot = p.position.layer === "interior" ? wagonOf(train, p.position).interior : wagonOf(train, p.position).techo;
        const bag = slot.items.find(i => i.kind === "bolsa");
        if (!bag) return;
        train = train.map((w, i) =>
          i === p.position.wagonIndex
            ? {
                ...w,
                interior:
                  p.position.layer === "interior" ? { ...w.interior, items: w.interior.items.filter(i2 => i2.id !== bag.id) } : w.interior,
                techo: p.position.layer === "techo" ? { ...w.techo, items: w.techo.items.filter(i2 => i2.id !== bag.id) } : w.techo,
              }
            : w,
        );
        players = players.map(pl => (pl.id === p.id ? { ...pl, cargo: [...pl.cargo, bag] } : pl));
      });
      break;
    }
    case "venganza_del_marshal": {
      // Cada bandido en el techo justo encima del vagón del Marshal pierde
      // su bolsa de menor valor (DESIGN.md 4.4 #7).
      players
        .filter(p => p.position.layer === "techo" && p.position.wagonIndex === marshal.position.wagonIndex)
        .forEach(p => {
          const bags = p.cargo.filter(i => i.kind === "bolsa");
          if (bags.length === 0) return;
          const lowest = bags.reduce((min, b) => (b.value < min.value ? b : min), bags[0]);
          players = players.map(pl => (pl.id === p.id ? { ...pl, cargo: pl.cargo.filter(i => i.id !== lowest.id) } : pl));
        });
      break;
    }
    case "secuestro_del_conductor": {
      // Cada bandido en la Locomotora (interior o techo) recibe un rescate
      // de $250 (DESIGN.md 4.4 #8).
      players.forEach(p => {
        if (p.position.wagonIndex !== 0) return;
        players = players.map(pl =>
          pl.id === p.id ? { ...pl, cargo: [...pl.cargo, { id: makeId("rescate"), kind: "bolsa", value: 250 }] } : pl,
        );
      });
      break;
    }
    case "alarma_en_el_tren": {
      // Contraparte de "Rebelión de pasajeros": todo el que esté en un techo
      // recibe bala neutral (evento propio de esta adaptación, DESIGN.md 4.4
      // #9).
      players.filter(p => p.position.layer === "techo").forEach(p => bullet(p.id));
      break;
    }
  }

  return { ...state, players, train, marshal, sharedNeutralBulletsRemaining, secondBriefcasePlaced };
}

// ─── Cierre de ronda / partida ───────────────────────────────────────────────

// Junta lo jugado (y las balas recibidas) de vuelta en el mazo personal de
// cada jugador, y pasa el rol de Jugador Inicial al de la izquierda
// (DESIGN.md 4.2 #4).
export function finishRound(state: GameState): GameState {
  const players = state.players.map(p => {
    const playedByMe = state.round.stack.filter(entry => entry.ownerId === p.id).map(entry => entry.card);
    // Lo jugado vuelve al mazo (junto con las balas recibidas, ya en
    // discardPile — ver giveBullet) — pero cualquier carta que le haya
    // quedado sin jugar en la mano también tiene que volver acá, o
    // desaparece para siempre la próxima vez que dealHands arme la mano
    // nueva solo a partir de drawPile+discardPile.
    return { ...p, hand: [], discardPile: [...p.discardPile, ...playedByMe, ...p.hand] };
  });

  if (state.round.roundNumber >= 5) {
    return computeGameEnd({ ...state, players, stage: "finished" });
  }

  const previousFirstIndex = state.round.turnOrder.indexOf(state.round.turnOrder[0]);
  const seatOrder = state.players.map(p => p.id);
  const seatIndexOfFirst = seatOrder.indexOf(state.round.turnOrder[0]);
  const nextFirstId = seatOrder[(seatIndexOfFirst + 1) % seatOrder.length];
  const nextTurnOrder = [nextFirstId, ...seatOrder.filter(id => id !== nextFirstId)];
  void previousFirstIndex;

  const roundNumber = (state.round.roundNumber + 1) as GameState["round"]["roundNumber"];
  const cardId = state.roundCardOrder[roundNumber - 1];
  const nextState: GameState = {
    ...state,
    players,
    round: emptyRoundState(roundNumber, cardId, nextTurnOrder),
    stage: "planning",
  };
  return dealHands(nextState);
}

export interface FinalScore {
  playerId: string;
  cargoTotal: number;
  pistolero: boolean;
  total: number;
}

// Suma botín + bono de Título de Pistolero, calcula ganador(es) con
// desempate de menos balas recibidas (DESIGN.md 4.5).
function computeGameEnd(state: GameState): GameState {
  const minBulletStock = Math.min(...state.players.map(p => p.ownBulletStock));
  const pistoleroWinnerIds = state.players.filter(p => p.ownBulletStock === minBulletStock).map(p => p.id);

  const scores: FinalScore[] = state.players.map(p => {
    const cargoTotal = p.cargo.reduce((sum, item) => sum + item.value, 0);
    const pistolero = pistoleroWinnerIds.includes(p.id);
    return { playerId: p.id, cargoTotal, pistolero, total: cargoTotal + (pistolero ? BRIEFCASE_VALUE : 0) };
  });
  const maxTotal = Math.max(...scores.map(s => s.total));
  const topScorers = scores.filter(s => s.total === maxTotal).map(s => s.playerId);
  let winnerIds = topScorers;
  if (topScorers.length > 1) {
    const minReceived = Math.min(...topScorers.map(id => findPlayer(state, id).bulletsReceivedTotal));
    winnerIds = topScorers.filter(id => findPlayer(state, id).bulletsReceivedTotal === minReceived);
  }

  return { ...state, pistoleroWinnerIds, winnerIds, stage: "finished" };
}

export function computeFinalScores(state: GameState): FinalScore[] {
  const minBulletStock = Math.min(...state.players.map(p => p.ownBulletStock));
  return state.players.map(p => {
    const cargoTotal = p.cargo.reduce((sum, item) => sum + item.value, 0);
    const pistolero = p.ownBulletStock === minBulletStock;
    return { playerId: p.id, cargoTotal, pistolero, total: cargoTotal + (pistolero ? BRIEFCASE_VALUE : 0) };
  });
}

export { CHARACTER_IDS };
