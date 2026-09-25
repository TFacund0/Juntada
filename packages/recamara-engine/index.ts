// ═══════════════════════════════════════════════════════════════════════════
// RECÁMARA — motor de reglas puro: tipos + funciones sin React, sin timers,
// sin animación. Compartido entre el modo local (frontend/src/games/
// recamara/LocalGame.tsx llama estas funciones directamente y decora el
// resultado con las cosas de UI — recoil, flash, log) y el motor online
// (backend/src/games/recamara/engine.ts envuelve estas mismas funciones con
// el contrato GameEngine — turnos autoritativos en el server, vista pública/
// privada, etc). Ningún lado duplica las reglas del juego.
// ═══════════════════════════════════════════════════════════════════════════
import { escapeHtml } from "@juntada/core-utils";

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

export const ITEM_POOL = ["🔍", "🚬", "🪚", "🔄", "🧤", "📞", "🔒"] as const;
export type ItemKind = (typeof ITEM_POOL)[number];

export const ITEM_LABEL: Record<ItemKind, string> = {
  "🔍": "Lupa — ver la bala actual",
  "🚬": "Cigarrillo — curar 1 vida",
  "🪚": "Sierra — recortar el caño (doble daño en el próximo disparo real)",
  "🔄": "Inversor — cambia el sentido de los turnos",
  "🧤": "Ladrón — robar un ítem de otro jugador (uno por turno, nunca otro ladrón)",
  "📞": "Teléfono — pista sobre una bala futura",
  "🔒": "Esposas — el objetivo pierde su próximo turno",
};

export interface Player {
  id: number;
  name: string;
  lives: number;
  items: ItemKind[];
  // Set by 🔒 — cleared (and the turn skipped) the next time turn
  // resolution would land on this player, see fireShot's skip loop below.
  cuffed?: boolean;
  // Exactly which items (0..ITEMS_PER_RELOAD) the most recent reload
  // actually granted this player — see reloadIfNeeded. An inventory already
  // at MAX_ITEMS simply doesn't gain the item that doesn't fit (nothing
  // else gets bumped to make room for it), so this can be shorter than
  // ITEMS_PER_RELOAD, or empty. The reveal screens (ChestReveal) read this
  // instead of guessing "the last ITEMS_PER_RELOAD items in the array" —
  // that guess would be wrong (and show already-owned items as if new)
  // whenever a reload granted fewer than a full batch.
  lastGrantedItems: ItemKind[];
}

export interface GameState {
  players: Player[];
  order: number[];
  direction: 1 | -1;
  turnPos: number;
  shells: Shell[];
  idx: number;
  sawedOff: boolean;
  // Someone already used a 🧤 during the current turn — only one steal per
  // turn (see canUseItem). Cleared whenever the turn passes to someone else;
  // a blank self-shot keeps the same turn, so it stays set. Optional so a
  // state saved before this rule existed still loads.
  stealUsedThisTurn?: boolean;
}

// 🔄 flips the turn order's direction — meaningless with only two players
// left (they'd just keep alternating either way), so it's excluded from the
// draw pool whenever exactly two players are still standing.
export function randomItem(aliveCount: number): ItemKind {
  const pool = aliveCount === 2 ? ITEM_POOL.filter(i => i !== "🔄") : ITEM_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}

// A blank drawn a little more often lands ahead of a live one in the shuffle
// — not a hard guarantee (this is a soft bias on the sort key below, not a
// forced ordering), just a slight lean toward blanks coming up earlier
// rather than every ordering being equally likely.
const BLANK_ORDER_BIAS = 0.15;

// 3 to 8 shells — mirrors the tabletop rule this game is based on (see
// recamara/index.tsx's `rules`). Both kinds are guaranteed to show up at
// least once (never an all-live or all-blank chamber), and lopsided splits
// are still very much allowed (that swinginess is the point) — the only
// extra guardrail is on the bigger chambers (6-8 shells), where the
// minority kind is guaranteed at least 2 rather than 1, so a full chamber
// can't land on the most extreme split (e.g. 7-1 or 5-1), just a slightly
// less extreme one.
const MIN_MINORITY_FOR_LARGE_CHAMBER = 2;
const LARGE_CHAMBER_THRESHOLD = 6;

export function buildShells(): Shell[] {
  const total = 3 + Math.floor(Math.random() * 6); // 3..8
  const minMinority = total >= LARGE_CHAMBER_THRESHOLD ? MIN_MINORITY_FOR_LARGE_CHAMBER : 1;
  const maxLive = total - minMinority;
  const live = minMinority + Math.floor(Math.random() * (maxLive - minMinority + 1));
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
  // Weighted shuffle instead of a plain Fisher-Yates: each shell gets a
  // random sort key, but a blank's key gets nudged down (sorts earlier) by
  // BLANK_ORDER_BIAS — still fully random, just leaning blanks toward the
  // front of the order rather than every permutation being equally likely.
  return arr
    .map(shell => ({ shell, key: Math.random() - (shell.kind === "blank" ? BLANK_ORDER_BIAS : 0) }))
    .sort((a, b) => a.key - b.key)
    .map(({ shell }) => shell);
}

export function createInitialState(names: string[]): GameState {
  // Round 1 plays with no items at all — just the shotgun itself, so a
  // fresh table learns the core loop before items start complicating it.
  // The first reload (start of round 2) is what hands out the first
  // ITEMS_PER_RELOAD items, same as every reload after it.
  const players: Player[] = names.map((name, i) => ({
    id: i,
    name: name.trim() || `Jugador ${i + 1}`,
    lives: STARTING_LIVES,
    items: [],
    lastGrantedItems: [],
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
  // Eliminated players are pure spectators from here on — they never draw
  // new items on a reload, only whoever's still alive does.
  const aliveCount = players.filter(p => p.lives > 0).length;
  const reloadedPlayers = players.map(p => {
    if (p.lives <= 0) return { ...p, lastGrantedItems: [] };
    const drawn = Array(ITEMS_PER_RELOAD)
      .fill(null)
      .map(() => randomItem(aliveCount));
    // Whatever doesn't fit under MAX_ITEMS is simply never granted — a full
    // inventory doesn't bump an older item to make room for a new one, it
    // just misses out on the new one. Deliberately the opposite of
    // capItems (used by 🧤 below), which favors whatever was *just* added;
    // here it's the other way around on purpose, so nothing you're already
    // holding can vanish just because a reload happened to land while you
    // were full.
    const room = Math.max(0, MAX_ITEMS - p.items.length);
    const granted = drawn.slice(0, room);
    return { ...p, items: [...p.items, ...granted], lastGrantedItems: granted };
  });
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
  // Ids of players whose upcoming turn got skipped because they were
  // cuffed (🔒), in the order they were skipped — empty on almost every
  // shot, only ever non-empty right after a cuffed player's turn comes up.
  skippedIds: number[];
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
      skippedIds: [],
    };
  }

  const reload = reloadIfNeeded(shells, players);
  const keepsTurn = targetId === shooter.id && shell.kind === "blank";
  let turnPos = keepsTurn ? state.turnPos : nextAliveTurnPos(state.turnPos, state.direction, state.order, reload.players);
  let finalPlayers = reload.players;
  const skippedIds: number[] = [];

  // A cuffed player's turn never actually happens — clear the cuff and keep
  // advancing past them. Bounded by order.length so an (unreachable in
  // practice) all-cuffed table can't loop forever.
  if (!keepsTurn) {
    for (let i = 0; i < state.order.length; i++) {
      const landedId = state.order[turnPos];
      const landed = finalPlayers.find(p => p.id === landedId);
      if (!landed?.cuffed) break;
      skippedIds.push(landedId);
      finalPlayers = finalPlayers.map(p => (p.id === landedId ? { ...p, cuffed: false } : p));
      turnPos = nextAliveTurnPos(turnPos, state.direction, state.order, finalPlayers);
    }
  }

  return {
    state: {
      ...state,
      players: finalPlayers,
      shells: reload.shells,
      idx: reload.idx,
      sawedOff: false,
      turnPos,
      stealUsedThisTurn: keepsTurn ? state.stealUsedThisTurn : false,
    },
    shooterId: shooter.id,
    targetId,
    shellKind: shell.kind,
    damage,
    reloaded: reload.reloaded,
    gameOver: false,
    winner: null,
    skippedIds,
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
  cuffedId?: number | null;
}

export interface UseItemOptions {
  // 🧤: rob this exact item from this exact opponent instead of a random
  // item from a random opponent — the UI lets you look at a rival's items
  // first and pick, so by the time this is called both are known.
  // 🔒: cuff this exact opponent instead of a random one.
  targetId?: number;
  stolenItem?: ItemKind;
}

// A 🧤 can take anything but another 🧤.
function stealableItems(player: Player): ItemKind[] {
  return player.items.filter(i => i !== "🧤");
}

// Whether the player whose turn it is may use this item right now: they have
// to actually hold it, and a 🧤 only works once per turn. The online engine
// checks this before applying a client's use_item; the UI uses it to disable
// what can't be used. Takes only the fields it reads, so the online client
// can pass its public view (whose shells are partly hidden) as well.
export function canUseItem(state: Pick<GameState, "players" | "order" | "turnPos" | "stealUsedThisTurn">, item: ItemKind): boolean {
  const player = state.players.find(p => p.id === state.order[state.turnPos]);
  if (!player?.items.includes(item)) return false;
  if (item === "🧤" && state.stealUsedThisTurn) return false;
  return true;
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
      if (state.stealUsedThisTurn) throw new Error("recamara: only one 🧤 per turn (check canUseItem first)");
      // Once it's used — even with nothing to steal — this turn's steal is spent.
      const after = { ...state, stealUsedThisTurn: true };
      const others = state.players.filter(p => p.id !== player.id && stealableItems(p).length > 0);
      if (others.length === 0) {
        return { state: { ...after, players: consumeItem(state, player.id, item) }, playerId: player.id, item, victimId: null };
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
      const loot = stealableItems(victim);
      const stolen =
        options?.stolenItem && loot.includes(options.stolenItem) ? options.stolenItem : loot[Math.floor(Math.random() * loot.length)];
      const players = consumeItem(state, player.id, item).map(p => {
        if (p.id === victim.id) {
          const items = [...p.items];
          items.splice(items.indexOf(stolen), 1);
          return { ...p, items };
        }
        if (p.id === player.id) return { ...p, items: capItems([...p.items, stolen]) };
        return p;
      });
      return { state: { ...after, players }, playerId: player.id, item, victimId: victim.id, stolenItem: stolen };
    }
    case "📞": {
      // Any not-yet-fired shell is fair game, including the very next one
      // (state.idx itself) — the one real constraint is that it can never
      // point at an already-fired shell, which `!revealed` already rules
      // out (fireShot marks the spent shell revealed too).
      const futureIdx = state.shells.map((_, i) => i).filter(i => i >= state.idx && !state.shells[i].revealed);
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
    case "🔒": {
      const others = state.players.filter(p => p.id !== player.id && p.lives > 0);
      if (others.length === 0) {
        return { state: { ...state, players: consumeItem(state, player.id, item) }, playerId: player.id, item, cuffedId: null };
      }
      // Same defend-against-a-stale/malicious targetId pattern as 🧤 above —
      // fall back to a random valid target instead of ever throwing.
      const requestedTarget = options?.targetId != null ? others.find(p => p.id === options.targetId) : undefined;
      const target = requestedTarget ?? others[Math.floor(Math.random() * others.length)];
      const players = consumeItem(state, player.id, item).map(p => (p.id === target.id ? { ...p, cuffed: true } : p));
      return { state: { ...state, players }, playerId: player.id, item, cuffedId: target.id };
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
  const shooterName = escapeHtml(nameOf(result.shooterId));
  const targetName = escapeHtml(nameOf(result.targetId));
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

// The turn that never happened because that player was cuffed — its own
// short log line, separate from the shot that triggered it, so it reads as
// its own beat instead of being folded into the shot's line.
export function describeSkippedTurn<TId>(playerId: TId, nameOf: (id: TId) => string): LogLine {
  return { text: `<b>${escapeHtml(nameOf(playerId))}</b> está esposado y pierde su turno.` };
}

export interface ItemDescribeInput<TId> {
  playerId: TId;
  item: ItemKind;
  revealedShellKind?: ShellKind;
  healedTo?: number;
  victimId?: TId | null;
  stolenItem?: ItemKind;
  phoneHint?: { positionFromNow: number; shellKind: ShellKind } | null;
  cuffedId?: TId | null;
}

export interface DescribeItemOptions {
  // 📞 only: online play keeps the actual hint private to whoever used it
  // (see backend/src/games/recamara/engine.ts's getPrivateView) — everyone
  // else, including the shared round log, only ever learns the phone got
  // used, never what it revealed. Local pass-and-play never sets this
  // (defaults to fully revealing), since there's no one to hide it from —
  // the whole table already shares one screen.
  revealPhoneHint?: boolean;
  // 🔍 only: same idea as revealPhoneHint — online play keeps what the
  // lupa revealed private to whoever used it, so the shared round log only
  // ever learns the lupa got used, never what shell it showed. Local
  // pass-and-play never sets this (defaults to fully revealing).
  revealLupaHint?: boolean;
}

export function describeItemResult<TId>(
  result: ItemDescribeInput<TId>,
  nameOf: (id: TId) => string,
  options?: DescribeItemOptions,
): LogLine {
  const name = escapeHtml(nameOf(result.playerId));
  switch (result.item) {
    case "🔍":
      if (options?.revealLupaHint === false) return { text: `<b>${name}</b> usa la lupa.` };
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
        text: `<b>${name}</b> le roba ${result.stolenItem ?? "un ítem"} a <b>${escapeHtml(nameOf(result.victimId))}</b>.`,
      };
    case "📞":
      if (options?.revealPhoneHint === false) return { text: `<b>${name}</b> llama por teléfono.` };
      if (!result.phoneHint) return { text: `<b>${name}</b> llama por teléfono, pero no queda ninguna bala futura para espiar.` };
      return {
        text: `<b>${name}</b> recibe una pista por teléfono: la bala en la posición <b>${result.phoneHint.positionFromNow}</b> del cargador es <b>${result.phoneHint.shellKind === "live" ? "real" : "falsa"}</b>.`,
      };
    case "🔒":
      if (result.cuffedId == null) return { text: `<b>${name}</b> intenta esposar a alguien, pero no hay a quién.` };
      return { text: `<b>${name}</b> le pone las esposas a <b>${escapeHtml(nameOf(result.cuffedId))}</b>: pierde su próximo turno.` };
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
  // Room ids of players whose turn got skipped by a cuff on the way to
  // whoever's turn it is now — see fireShot's skippedIds.
  skippedIds: string[];
}
export interface LastItemEvent {
  seq: number;
  playerId: string;
  item: ItemKind;
  revealedShellKind?: ShellKind;
  healedTo?: number;
  victimId?: string | null;
  stolenItem?: ItemKind;
  // Never populated here — the real hint only ever reaches the player who
  // used the phone, via their own private_role message (see
  // backend/src/games/recamara/engine.ts's getPrivateView). Kept on this
  // shared wire type only so describeItemResult's shape lines up whichever
  // side (redacted public event, or the actor's own merged-in private hint)
  // ends up calling it.
  phoneHint?: { positionFromNow: number; shellKind: ShellKind } | null;
  cuffedId?: string | null;
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
