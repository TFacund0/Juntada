// ═══════════════════════════════════════════════════════════════════════════
// RIEL SALVAJE — modelo de datos puro (Fase 0 del PLAN.md). Solo tipos, sin
// ninguna función ni lógica todavía — eso llega en Fase 1
// (`backend/src/games/riel-salvaje/engine.ts` + funciones puras separadas).
// Ver DESIGN.md en frontend/src/games/riel-salvaje/ para la especificación
// completa de reglas que estos tipos representan.
//
// Nunca usar los 6 nombres de personaje reales del juego original ni su
// nombre comercial — solo Víbora/Trueno/Sombra/Búho/Dalia/Urraca y "Riel
// Salvaje" (ver nota de propiedad intelectual en DESIGN.md).
// ═══════════════════════════════════════════════════════════════════════════

// ─── Personajes ──────────────────────────────────────────────────────────────

export type CharacterId = "vibora" | "trueno" | "sombra" | "buho" | "dalia" | "urraca";

export const CHARACTER_IDS: readonly CharacterId[] = ["vibora", "trueno", "sombra", "buho", "dalia", "urraca"];

// ─── Botín ───────────────────────────────────────────────────────────────────

export type CargoKind = "bolsa" | "joya" | "maletin";

// El valor real vive siempre acá — es la Fase 2 (getPublicRoundView) la que
// decide si lo oculta a quien no sea el dueño, nunca este tipo (ver nota en
// PLAN.md Fase 0: "no mezclado indistintamente con el resto del estado").
export interface CargoItem {
  id: string;
  kind: CargoKind;
  value: number;
}

// ─── Tren ────────────────────────────────────────────────────────────────────

export type Layer = "interior" | "techo";

export interface WagonSlot {
  occupantIds: string[]; // ids de jugador presentes en esta capa de este vagón
  items: CargoItem[]; // botín todavía no robado, tirado en el piso de esta capa
}

export interface Wagon {
  index: number; // 0 = Locomotora, 1..N = vagones en orden hacia la cola
  isLocomotora: boolean;
  interior: WagonSlot;
  // El Marshal nunca sube al techo — igual se modela el slot para que todo
  // vagón tenga la misma forma (ver DESIGN.md 2: "el Marshal nunca sube al
  // techo, así que ahí siempre están a salvo de él").
  techo: WagonSlot;
}

export type Train = Wagon[];

export interface Position {
  wagonIndex: number;
  layer: Layer;
}

// ─── Cartas de acción ────────────────────────────────────────────────────────

// "mover" es una sola carta — la dirección (izquierda/derecha) se elige
// recién al jugarla, no son dos cartas separadas (2 mover + 2 cambiar_piso +
// 2 disparar + 2 robar + 1 golpear + 1 mover_marshal = 10, ver DESIGN.md 4.1).
export type ActionCardKind = "mover" | "cambiar_piso" | "disparar" | "robar" | "golpear" | "mover_marshal";

export interface ActionCard {
  id: string;
  kind: ActionCardKind;
}

// Carta de Bala recibida de un disparo — se mezcla en el mazo del jugador
// baleado, no en el del tirador (ver DESIGN.md 4.3). Se modela aparte de
// ActionCard porque no es una acción elegible en Planificación, solo un
// "hueco" que obliga a robar cuando sale.
export interface BulletCard {
  id: string;
  kind: "bala";
  // "neutral" = del mazo compartido de 13 (Marshal/eventos), "jugador" = de
  // un disparo de otro bandido (para el Título de Pistolero solo cuentan
  // las que salieron de un jugador, ver DESIGN.md 4.5).
  source: "neutral" | { shooterId: string };
}

export type DeckCard = ActionCard | BulletCard;

// Una carta ya apilada en Planificación — boca arriba se conoce su kind
// desde que se juega, boca abajo (turno Túnel) el motor debe seguir
// sabiendo qué es (para resolver la fase Acción) pero la Fase 2
// (getPrivateView) no debe exponérselo a nadie más que al dueño hasta que
// se revele.
export interface PlannedCard {
  card: DeckCard;
  faceDown: boolean;
  ownerId: string;
}

// ─── Jugador ─────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  character: CharacterId;
  position: Position;
  hand: DeckCard[]; // cartas en mano, listas para jugarse
  drawPile: DeckCard[]; // mazo propio para robar
  discardPile: DeckCard[]; // cartas ya resueltas esta ronda, vuelven al mazo al terminarla
  cargo: CargoItem[]; // botín que lleva encima (incluye la bolsa inicial de $250)
  // Total de balas recibidas en toda la partida — de otros jugadores O de
  // eventos/Marshal (bala neutral), ambas cuentan (DESIGN.md 4.5: "menos
  // cartas de Bala de otros jugadores y de eventos") — para el desempate de
  // fin de partida. No se resetea entre rondas.
  bulletsReceivedTotal: number;
  // Cuántas balas propias (de su color) le quedan sin gastar — cada
  // "disparar" resuelto en la fase Acción consume una de acá y se la entrega
  // al objetivo como BulletCard (source: {shooterId}). El Título de
  // Pistolero (DESIGN.md 4.5) es para quien termina con MENOS acá: disparó
  // más veces. No se resetea entre rondas — es un recurso de toda la
  // partida.
  ownBulletStock: number;
  // Marca de habilidad de Sombra: true si ya jugó su primer turno de la
  // ronda actual (jugando, no robando) — se resetea a false al empezar cada
  // ronda. Si el primer turno lo usa para robar 3 en vez de jugar, la
  // habilidad se pierde ese turno (DESIGN.md 3) sin necesidad de un campo
  // aparte: simplemente no vuelve a chequearse hasta la ronda siguiente.
  sombraFirstTurnPlayed: boolean;
}

// ─── Marshal ─────────────────────────────────────────────────────────────────

export interface Marshal {
  position: Position; // layer siempre "interior": nunca sube al techo
}

// ─── Carta de ronda ──────────────────────────────────────────────────────────

export type TurnIcon = "boca_arriba" | "tunel" | "acelerar" | "cambio_de_via";

export type RoundEventId =
  | "marshal_furioso"
  | "brazo_giratorio"
  | "frenada"
  | "llevatelo_todo"
  | "rebelion_de_pasajeros"
  | "carterismo"
  | "venganza_del_marshal"
  | "secuestro_del_conductor"
  | "alarma_en_el_tren";

// Las 7 cartas del mazo principal (rondas 1-4) + las 3 de "Estación de tren"
// (ronda 5) — ver DESIGN.md 4.4.1 para el layout exacto de turnos de cada
// una.
export type RoundCardId =
  | "marshal_furioso"
  | "gancho_de_correo"
  | "freno"
  | "a_por_todas"
  | "rebelion_de_pasajeros"
  | "via_libre"
  | "silbato_de_alarma"
  | "carterismo"
  | "venganza_del_marshal"
  | "secuestro_del_conductor";

export interface RoundCardDef {
  id: RoundCardId;
  turns: TurnIcon[]; // un ícono por turno de Planificación, en orden
  event: RoundEventId | null; // null solo para "Vía libre"
}

// ─── Estado de una ronda en curso ────────────────────────────────────────────

export type RoundPhase = "planning" | "action" | "round_event";

export interface RoundState {
  roundNumber: 1 | 2 | 3 | 4 | 5;
  cardId: RoundCardId;
  phase: RoundPhase;
  // Orden de turno de ESTA ronda — cambia de sentido si el ícono
  // "cambio_de_via" aparece en algún turno (DESIGN.md 4.1), por eso se
  // guarda materializado acá en vez de derivarlo del orden de asientos.
  turnOrder: string[]; // player ids
  // Índice dentro de turnOrder de a quién le toca jugar en Planificación.
  currentPlayerIndex: number;
  // Sentido en el que avanza currentPlayerIndex sobre turnOrder — 1 normal,
  // -1 desde que aparece un ícono "cambio_de_via" (DESIGN.md 4.1 punto 3).
  direction: 1 | -1;
  // Cartas ya jugadas por el jugador actual dentro del turno-ícono en curso
  // — 0 salvo a mitad de un turno "acelerar" (que pide 2 antes de pasar al
  // siguiente jugador).
  playsUsedThisTurn: number;
  // Cuántos turnos de Planificación (íconos de la carta) ya se completaron
  // (todos los jugadores jugaron su carta para ese ícono).
  turnsCompleted: number;
  // Pila combinada de todo lo jugado en Planificación, en el orden exacto en
  // que se apiló — es lo que la fase Acción recorre en orden al resolver
  // (DESIGN.md 4.2: "orden de resolución es el orden en que se apilaron").
  stack: PlannedCard[];
  // Puntero de resolución dentro de `stack` durante la fase Acción.
  actionCursor: number;
}

// ─── Estado global de la partida ────────────────────────────────────────────

export type GameStage = "planning" | "action" | "round_event" | "finished";

export interface GameState {
  train: Train;
  marshal: Marshal;
  players: Player[];
  // Cuántas balas neutrales quedan en el mazo compartido de 13 — si llega a
  // 0, ningún evento/Marshal vuelve a repartir por el resto de la partida
  // (DESIGN.md 2).
  sharedNeutralBulletsRemaining: number;
  // El segundo maletín ($1000), guardado fuera del tren hasta que el evento
  // "¡A por todas!" lo coloca en el vagón del Marshal (DESIGN.md 2 y 4.4).
  secondBriefcasePlaced: boolean;
  // Los 4 mazo-principal + 1 de "Estación de tren" sorteados al arrancar la
  // partida, en el orden en que se juegan (DESIGN.md 4).
  roundCardOrder: RoundCardId[];
  round: RoundState;
  stage: GameStage;
  // Jugador (o jugadores, en empate) con el Título de Pistolero — solo se
  // calcula al terminar la partida (DESIGN.md 4.5), null mientras se juega.
  pistoleroWinnerIds: string[] | null;
  // Ganador(es) final(es) por botín total, con el desempate de menos balas
  // recibidas ya aplicado (DESIGN.md 4.5) — null mientras se juega.
  winnerIds: string[] | null;
}
