// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — motor de reglas puro: tipos + funciones sin React, sin timers,
// sin animación. Compartido entre el modo local (frontend/src/games/
// recamara/LocalGame.tsx llama estas funciones directamente y decora el
// resultado con las cosas de UI — recoil, flash, log) y el motor online
// (backend/src/games/recamara/engine.ts envuelve estas mismas funciones con
// el contrato GameEngine — turnos autoritativos en el server, vista pública/
// privada, etc). Ningún lado duplica las reglas del juego.
// ═══════════════════════════════════════════════════════════════════════════

export const STARTING_LIVES = 5;
export const MAX_LIVES = 5;
export const ITEMS_PER_RELOAD = 2;
// A player's own inventory never grows past this — whenever something
// would add to it (a reload, robbing an item), the oldest items get bumped
// first so the total never exceeds it. Applies the same in local and
// online since both call this same capItems helper.
export const MAX_ITEMS = 5;

export type ShellKind = "live" | "blank";

export interface Shell {
  kind: ShellKind;
  spent: boolean;
  revealed: boolean;
}

export const ITEM_POOL = ["🔍", "🚬", "🪚", "🔄", "🧤", "📞"] as const;
export type ItemKind = (typeof ITEM_POOL)[number];

export const ITEM_LABEL: Record<ItemKind, string> = {
  "🔍": "Lupa — ver la bala actual",
  "🚬": "Cigarrillo — curar 1 vida",
  "🪚": "Sierra — recortar el caño (doble daño en el próximo disparo real)",
  "🔄": "Inversor — cambia el sentido de los turnos",
  "🧤": "Ladrón — robar un ítem al azar de otro jugador",
  "📞": "Teléfono — pista sobre una bala futura",
};

export interface Player {
  id: number;
  name: string;
  lives: number;
  items: ItemKind[];
}

export interface GameState {
  players: Player[];
  order: number[];
  direction: 1 | -1;
  turnPos: number;
  shells: Shell[];
  idx: number;
  sawedOff: boolean;
}

export function randomItem(): ItemKind {
  return ITEM_POOL[Math.floor(Math.random() * ITEM_POOL.length)];
}

// Up to 8 shells, any real/blank split — mirrors the tabletop rule this game
// is based on (see recamara/index.tsx's `rules`).
export function buildShells(): Shell[] {
  const total = 2 + Math.floor(Math.random() * 7); // 2..8
  const live = 1 + Math.floor(Math.random() * total); // 1..total
  const blank = total - live;
  const arr: Shell[] = (
    Array(live)
      .fill(null)
      .map(() => ({ kind: "live" as const, spent: false, revealed: false })) as Shell[]
  ).concat(
    Array(blank)
      .fill(null)
      .map(() => ({ kind: "blank" as const, spent: false, revealed: false })),
  );
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function createInitialState(names: string[]): GameState {
  const players: Player[] = names.map((name, i) => ({
    id: i,
    name: name.trim() || `Jugador ${i + 1}`,
    lives: STARTING_LIVES,
    items: Array(ITEMS_PER_RELOAD)
      .fill(null)
      .map(() => randomItem()),
  }));
  return {
    players,
    order: players.map(p => p.id),
    direction: 1,
    turnPos: 0,
    shells: buildShells(),
    idx: 0,
    sawedOff: false,
  };
}

export function currentPlayer(state: GameState): Player {
  const id = state.order[state.turnPos];
  const player = state.players.find(p => p.id === id);
  if (!player) throw new Error("recamara: current turn points at a player that no longer exists");
  return player;
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter(p => p.lives > 0);
}

function findPlayer(players: Player[], id: number): Player {
  const player = players.find(p => p.id === id);
  if (!player) throw new Error(`recamara: no player with id ${id}`);
  return player;
}

function nextAliveTurnPos(fromPos: number, dir: 1 | -1, order: number[], players: Player[]): number {
  let pos = fromPos;
  for (let i = 0; i < order.length; i++) {
    pos = (pos + dir + order.length) % order.length;
    const player = players.find(p => p.id === order[pos]);
    if (player && player.lives > 0) return pos;
  }
  return fromPos;
}

// Bumps the oldest items off the front once the total would exceed
// MAX_ITEMS — whatever was just added (appended at the end by the caller)
// survives as long as it fits.
function capItems(items: ItemKind[]): ItemKind[] {
  return items.length > MAX_ITEMS ? items.slice(-MAX_ITEMS) : items;
}

function reloadIfNeeded(shells: Shell[], players: Player[]): { shells: Shell[]; idx: number; players: Player[]; reloaded: boolean } {
  if (!shells.every(s => s.spent)) {
    return { shells, idx: shells.findIndex(s => !s.spent), players, reloaded: false };
  }
  const reloadedPlayers = players.map(p => ({
    ...p,
    items: capItems([
      ...p.items,
      ...Array(ITEMS_PER_RELOAD)
        .fill(null)
        .map(() => randomItem()),
    ]),
  }));
  return { shells: buildShells(), idx: 0, players: reloadedPlayers, reloaded: true };
}

export interface FireResult {
  state: GameState;
  shooterId: number;
  targetId: number;
  shellKind: ShellKind;
  damage: number;
  reloaded: boolean;
  gameOver: boolean;
  winner: Player | null;
}

export function fireShot(state: GameState, targetId: number): FireResult {
  const shooter = currentPlayer(state);
  const shell = state.shells[state.idx];
  const damage = shell.kind === "live" ? (state.sawedOff ? 2 : 1) : 0;

  const players =
    damage > 0 ? state.players.map(p => (p.id === targetId ? { ...p, lives: Math.max(0, p.lives - damage) } : p)) : state.players;

  const shells = state.shells.map((s, i) => (i === state.idx ? { ...s, spent: true, revealed: true } : s));

  const alive = players.filter(p => p.lives > 0);
  if (alive.length <= 1) {
    return {
      state: { ...state, players, shells, sawedOff: false },
      shooterId: shooter.id,
      targetId,
      shellKind: shell.kind,
      damage,
      reloaded: false,
      gameOver: true,
      winner: alive[0] ?? null,
    };
  }

  const reload = reloadIfNeeded(shells, players);
  const keepsTurn = targetId === shooter.id && shell.kind === "blank";
  const turnPos = keepsTurn ? state.turnPos : nextAliveTurnPos(state.turnPos, state.direction, state.order, reload.players);

  return {
    state: { ...state, players: reload.players, shells: reload.shells, idx: reload.idx, sawedOff: false, turnPos },
    shooterId: shooter.id,
    targetId,
    shellKind: shell.kind,
    damage,
    reloaded: reload.reloaded,
    gameOver: false,
    winner: null,
  };
}

export interface ItemResult {
  state: GameState;
  playerId: number;
  item: ItemKind;
  revealedShellKind?: ShellKind;
  healedTo?: number;
  victimId?: number | null;
  stolenItem?: ItemKind;
  phoneHint?: { positionFromNow: number; shellKind: ShellKind } | null;
}

export interface UseItemOptions {
  // 🧤 only: rob this exact item from this exact opponent instead of a
  // random item from a random opponent — the UI lets you look at a rival's
  // items first and pick, so by the time this is called both are known.
  targetId?: number;
  stolenItem?: ItemKind;
}

function consumeItem(state: GameState, playerId: number, item: ItemKind): Player[] {
  return state.players.map(p => {
    if (p.id !== playerId) return p;
    const i = p.items.indexOf(item);
    if (i === -1) return p;
    const items = [...p.items];
    items.splice(i, 1);
    return { ...p, items };
  });
}

export function useItem(state: GameState, item: ItemKind, options?: UseItemOptions): ItemResult {
  const player = currentPlayer(state);
  const shell = state.shells[state.idx];

  switch (item) {
    case "🔍": {
      const shells = state.shells.map((s, i) => (i === state.idx ? { ...s, revealed: true } : s));
      return {
        state: { ...state, shells, players: consumeItem(state, player.id, item) },
        playerId: player.id,
        item,
        revealedShellKind: shell.kind,
      };
    }
    case "🚬": {
      const players = consumeItem(state, player.id, item).map(p =>
        p.id === player.id ? { ...p, lives: Math.min(MAX_LIVES, p.lives + 1) } : p,
      );
      const healed = findPlayer(players, player.id);
      return { state: { ...state, players }, playerId: player.id, item, healedTo: healed.lives };
    }
    case "🪚": {
      return { state: { ...state, sawedOff: true, players: consumeItem(state, player.id, item) }, playerId: player.id, item };
    }
    case "🔄": {
      return {
        state: { ...state, direction: state.direction === 1 ? -1 : 1, players: consumeItem(state, player.id, item) },
        playerId: player.id,
        item,
      };
    }
    case "🧤": {
      const others = state.players.filter(p => p.id !== player.id && p.items.length > 0);
      if (others.length === 0) {
        return { state: { ...state, players: consumeItem(state, player.id, item) }, playerId: player.id, item, victimId: null };
      }
      // options come straight off the wire in the online engine — an
      // out-of-date or malicious targetId/stolenItem must never crash this
      // (findPlayer would throw if targetId names someone not currently in
      // `others`, e.g. already down to 0 items) or let a client fabricate an
      // item the victim doesn't actually have (silently deleting the wrong
      // item via indexOf's -1/"from the end" splice behavior). Both fall
      // back to a random, always-valid pick instead.
      const requestedVictim = options?.targetId != null ? others.find(p => p.id === options.targetId) : undefined;
      const victim = requestedVictim ?? others[Math.floor(Math.random() * others.length)];
      const stolen =
        options?.stolenItem && victim.items.includes(options.stolenItem)
          ? options.stolenItem
          : victim.items[Math.floor(Math.random() * victim.items.length)];
      const players = consumeItem(state, player.id, item).map(p => {
        if (p.id === victim.id) {
          const items = [...p.items];
          items.splice(items.indexOf(stolen), 1);
          return { ...p, items };
        }
        if (p.id === player.id) return { ...p, items: capItems([...p.items, stolen]) };
        return p;
      });
      return { state: { ...state, players }, playerId: player.id, item, victimId: victim.id, stolenItem: stolen };
    }
    case "📞": {
      const futureIdx = state.shells.map((_, i) => i).filter(i => i > state.idx && !state.shells[i].revealed);
      if (futureIdx.length === 0) {
        return { state: { ...state, players: consumeItem(state, player.id, item) }, playerId: player.id, item, phoneHint: null };
      }
      const pick = futureIdx[Math.floor(Math.random() * futureIdx.length)];
      const shells = state.shells.map((s, i) => (i === pick ? { ...s, revealed: true } : s));
      return {
        state: { ...state, shells, players: consumeItem(state, player.id, item) },
        playerId: player.id,
        item,
        phoneHint: { positionFromNow: pick - state.idx + 1, shellKind: state.shells[pick].kind },
      };
    }
  }
}

export interface LogLine {
  text: string;
  cls?: "danger" | "safe";
}

// Turns a FireResult/ItemResult into the Spanish log line both LocalGame and
// the online RoundView show — kept here (not in either component) so the
// wording can never drift between local and online. Generic over the id
// type (and taking a `nameOf` resolver instead of a Player[] to search)
// specifically so the *same* function serves both: local calls it with the
// engine's own numeric Player.id and a lookup into its own player array,
// online calls it directly on its wire payload (whose shooterId/targetId/
// playerId/victimId are already real room player ids) and a lookup into
// room.players — neither side needs its own copy of this wording.
// Split in two so the result banner can put "quién le disparó a quién" on
// one line and the real/falso verdict (with its own color) on the next,
// instead of one run-on sentence.
export interface FireOutcome {
  actionLine: string;
  shellLine: string;
  cls: "danger" | "safe";
}

export interface FireDescribeInput<TId> {
  shooterId: TId;
  targetId: TId;
  shellKind: ShellKind;
  damage: number;
}

export function describeFireOutcome<TId>(result: FireDescribeInput<TId>, nameOf: (id: TId) => string): FireOutcome {
  const shooterName = nameOf(result.shooterId);
  const targetName = nameOf(result.targetId);
  const targetsSelf = result.targetId === result.shooterId;
  const actionLine = targetsSelf
    ? `<b>${shooterName}</b> se dispara a sí mismo.`
    : `<b>${shooterName}</b> le dispara a <b>${targetName}</b>.`;

  if (result.shellKind === "live") {
    const sawNote = result.damage > 1 ? " (doble daño por la sierra)" : "";
    return { actionLine, shellLine: `Cartucho real${sawNote} — pierde vida`, cls: "danger" };
  }
  return { actionLine, shellLine: "Cartucho falso — sin daño", cls: "safe" };
}

export function describeFireResult<TId>(result: FireDescribeInput<TId>, nameOf: (id: TId) => string): LogLine {
  const { actionLine, shellLine, cls } = describeFireOutcome(result, nameOf);
  return { text: `${actionLine} ${shellLine}.`, cls };
}

export interface ItemDescribeInput<TId> {
  playerId: TId;
  item: ItemKind;
  revealedShellKind?: ShellKind;
  healedTo?: number;
  victimId?: TId | null;
  stolenItem?: ItemKind;
  phoneHint?: { positionFromNow: number; shellKind: ShellKind } | null;
}

export function describeItemResult<TId>(result: ItemDescribeInput<TId>, nameOf: (id: TId) => string): LogLine {
  const name = nameOf(result.playerId);
  switch (result.item) {
    case "🔍":
      return { text: `<b>${name}</b> usa la lupa: la próxima bala es <b>${result.revealedShellKind === "live" ? "real" : "falsa"}</b>.` };
    case "🚬":
      return { text: `<b>${name}</b> fuma un cigarrillo y recupera 1 vida.` };
    case "🪚":
      return { text: `<b>${name}</b> recorta el caño: el próximo disparo real hará doble daño.` };
    case "🔄":
      return { text: `<b>${name}</b> invierte el sentido de los turnos.` };
    case "🧤":
      if (result.victimId == null) return { text: `<b>${name}</b> intenta robar un ítem, pero nadie tiene ninguno.` };
      return {
        text: `<b>${name}</b> le roba ${result.stolenItem ?? "un ítem"} a <b>${nameOf(result.victimId)}</b>.`,
      };
    case "📞":
      if (!result.phoneHint) return { text: `<b>${name}</b> llama por teléfono, pero no queda ninguna bala futura para espiar.` };
      return {
        text: `<b>${name}</b> recibe una pista por teléfono: la bala en la posición <b>${result.phoneHint.positionFromNow}</b> del cargador es <b>${result.phoneHint.shellKind === "live" ? "real" : "falsa"}</b>.`,
      };
  }
}

// ─── Online wire types ───────────────────────────────────────────────────
// The shape backend/src/games/recamara/engine.ts's getPublicRoundView sends
// over the wire, and frontend/src/games/recamara/RoundView.tsx renders —
// defined once here so a field rename on one side can't silently desync
// from the other (they used to be two hand-mirrored copies).
export interface PublicShell extends Omit<Shell, "kind"> {
  kind: ShellKind | null; // stripped for anything not yet revealed — the one real secret
}
export interface PublicGameState extends Omit<GameState, "shells"> {
  shells: PublicShell[];
}
export interface PendingFire {
  seq: number;
  shooterId: string;
  targetId: string;
  shellKind: ShellKind;
  damage: number;
  gameOver: boolean;
  winnerId: string | null;
  reloaded: boolean;
}
export interface LastItemEvent {
  seq: number;
  playerId: string;
  item: ItemKind;
  revealedShellKind?: ShellKind;
  healedTo?: number;
  victimId?: string | null;
  stolenItem?: ItemKind;
  phoneHint?: { positionFromNow: number; shellKind: ShellKind } | null;
}
export interface RecamaraRoundView {
  seatOrder: string[];
  state: PublicGameState;
  // Aggregate real/falso split for the whole chamber — the shells above
  // have their per-shell `kind` stripped for anything unrevealed, so this
  // is sent separately instead of derived from them.
  liveCount: number;
  blankCount: number;
  subPhase: "reveal" | "duel";
  roundNumber: number;
  readyForDuel: string[];
  pendingFire: PendingFire | null;
  lastItemEvent: LastItemEvent | null;
  log: LogLine[];
  winnerRoomId: string | null;
}
