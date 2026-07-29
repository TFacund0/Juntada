const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../src/games/riel-salvaje/engine");
const rules = require("../src/games/riel-salvaje/rules");

interface TestPlayer {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
}
interface TestRoom {
  code: string;
  hostId: string;
  players: TestPlayer[];
  config: Record<string, any>;
  round: any;
  usedWords: Record<string, unknown>;
  roundHistory: any[];
  phase?: string;
}

function makePlayers(count: number): TestPlayer[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, name: `Jugador ${i + 1}`, ready: false, online: true }));
}

function makeRoom(playerCount = 4): TestRoom {
  return {
    code: "TEST1",
    hostId: "p1",
    players: makePlayers(playerCount),
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

test("startRound rejects fewer than 3 or more than 6 players", () => {
  const tooFew = makeRoom(2);
  assert.ok(engine.startRound(tooFew).error);
  const tooMany = makeRoom(7);
  assert.ok(engine.startRound(tooMany).error);
});

test("startRound assigns a distinct character to each player and opens the room for play", () => {
  const room = makeRoom(4);
  const res = engine.startRound(room);
  assert.ok(res.success);
  assert.equal(room.phase, "playing");
  const view = engine.getPublicRoundView(room);
  const characters = view.players.map((p: any) => p.character);
  assert.equal(new Set(characters).size, 4);
});

test("getPublicRoundView never leaks hand contents or real bag values, only sizes/kinds", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  const view = engine.getPublicRoundView(room);
  view.players.forEach((p: any) => {
    assert.equal(typeof p.handSize, "number");
    assert.ok(p.hand === undefined);
    p.cargo.forEach((item: any) => assert.equal(item.value, null));
  });
});

test("getPrivateView hands back the requesting player's real hand and cargo values, nobody else's", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  const privateP1 = engine.getPrivateView(room, "p1");
  assert.ok(Array.isArray(privateP1.hand));
  assert.ok(privateP1.hand.length > 0);
  assert.ok(privateP1.cargoValues.some((c: any) => c.value === 250)); // bolsa inicial
});

test("play_card is rejected out of turn, accepted in turn", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  const view = engine.getPublicRoundView(room);
  const currentId = view.round.currentPlayerId;
  const otherId = room.players.find((p: TestPlayer) => p.id !== currentId)!.id;

  const otherHand = engine.getPrivateView(room, otherId).hand;
  const badRes = engine.handleAction(room, otherId, "play_card", { cardId: otherHand[0].id });
  assert.equal(badRes.handled, false);

  const myHand = engine.getPrivateView(room, currentId).hand;
  const goodRes = engine.handleAction(room, currentId, "play_card", { cardId: myHand[0].id });
  assert.equal(goodRes.handled, true);
});

// Fuerza la fase Acción con una pila NO vacía — jugando cartas reales en vez
// de robar 3, para poder ejercitar resolve_card sobre entradas concretas.
function fillPlanningByPlaying(room: TestRoom): void {
  for (let i = 0; i < 200; i++) {
    const view = engine.getPublicRoundView(room);
    if (view.round.phase !== "planning") break;
    const currentId = view.round.currentPlayerId;
    const hand = engine.getPrivateView(room, currentId).hand;
    const res = engine.handleAction(room, currentId, "play_card", { cardId: hand[0].id });
    assert.ok(res.handled);
  }
}

test("draw_three is rejected once the planning phase has moved into action", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  fillPlanningByPlaying(room);
  const view = engine.getPublicRoundView(room);
  assert.equal(view.round.phase, "action");
  const someoneId = room.players[0].id;
  const res = engine.handleAction(room, someoneId, "draw_three", {});
  assert.equal(res.handled, false);
});

test("an empty planning phase (everyone draws instead of playing) auto-closes the round instead of getting stuck in action", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  for (let i = 0; i < 200; i++) {
    const view = engine.getPublicRoundView(room);
    if (view.round.phase !== "planning" || view.round.roundNumber !== 1) break;
    engine.handleAction(room, view.round.currentPlayerId, "draw_three", {});
  }
  const view = engine.getPublicRoundView(room);
  // Nada quedó apilado esa ronda 1 — el engine debió cerrar la ronda solo
  // (evento + finishRound), en vez de quedar trabado en "action" esperando
  // una carta que nunca se apiló.
  assert.ok(view.stage === "finished" || view.round.roundNumber > 1);
});

test("resolve_card only accepts the current stack entry's owner, and closes out the round once the stack is done", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  fillPlanningByPlaying(room);
  let view = engine.getPublicRoundView(room);
  assert.equal(view.round.phase, "action");
  assert.ok(view.round.stack.length > 0);

  // Para "disparar"/"golpear" con alguien en rango hace falta un targetId
  // válido — se calcula acá con el mismo helper que usa el motor puro,
  // mirando directo el estado interno (room.round.state) que el engine
  // guarda, en vez de reimplementar la lógica de línea de visión.
  function payloadFor(entry: any): Record<string, unknown> {
    const state = room.round.state;
    if (entry.card.kind === "disparar") {
      const targets = rules.reachableShotTargets(state, entry.ownerId);
      // Si Dalia es alcanzable pero hay otro objetivo válido también, no es
      // un target legal (DESIGN.md 3) — evitarla cuando haya alternativa,
      // para no toparse con ese rechazo esperado en este picker de test.
      const dalia = targets.find((id: string) => state.players.find((p: any) => p.id === id)?.character === "dalia");
      const nonDalia = targets.find((id: string) => id !== dalia);
      const targetId = nonDalia ?? dalia;
      // direction:1 va siempre — lo ignora cualquiera que no sea Trueno, y
      // a Trueno ahora le hace falta explícita (su empujón es obligatorio,
      // no opcional).
      return targetId ? { targetId, direction: 1 } : {};
    }
    if (entry.card.kind === "golpear") {
      const attacker = state.players.find((p: any) => p.id === entry.ownerId);
      const candidates = state.players.filter(
        (p: any) =>
          p.id !== entry.ownerId && p.position.wagonIndex === attacker.position.wagonIndex && p.position.layer === attacker.position.layer,
      );
      // Mismo motivo que en "disparar": evitar Dalia como blanco cuando hay
      // otra alternativa válida en el mismo vagón y piso.
      const victim = candidates.find((p: any) => p.character !== "dalia") ?? candidates[0];
      if (!victim) return {};
      return { targetId: victim.id, itemId: victim.cargo[0]?.id, pushDirection: 1 };
    }
    return { direction: 1 };
  }

  let guard = 0;
  while (view.round.phase === "action" && guard < 500) {
    guard += 1;
    // Se lee la pila real desde el estado interno (no la vista pública, que
    // oculta el kind de una carta Túnel todavía sin resolver incluso para su
    // propio dueño en este helper de test).
    const entry = room.round.state.round.stack[room.round.state.round.actionCursor];
    const notOwner = room.players.find((p: TestPlayer) => p.id !== entry.ownerId)!.id;
    const bad = engine.handleAction(room, notOwner, "resolve_card", {});
    assert.equal(bad.handled, false);
    const good = engine.handleAction(room, entry.ownerId, "resolve_card", payloadFor(entry));
    assert.ok(good.handled, `no se pudo resolver una carta ${entry.card.kind}`);
    view = engine.getPublicRoundView(room);
  }
  assert.notEqual(view.round.phase, "action");
});

test("a full game (drawing 3 every planning turn across all 5 rounds) reaches stage finished with a public final score", () => {
  const room = makeRoom(4);
  engine.startRound(room);
  let view = engine.getPublicRoundView(room);
  let guard = 0;
  while (view.stage !== "finished" && guard < 3000) {
    guard += 1;
    if (view.round.phase === "planning") {
      engine.handleAction(room, view.round.currentPlayerId, "draw_three", {});
    } else if (view.round.phase === "action") {
      const entry = view.round.stack[view.round.actionCursor];
      if (entry) engine.handleAction(room, entry.ownerId, "resolve_card", {});
    }
    view = engine.getPublicRoundView(room);
  }
  assert.equal(view.stage, "finished");
  assert.equal(room.phase, "result");
  assert.ok(Array.isArray(view.winnerIds) && view.winnerIds.length > 0);
  assert.ok(Array.isArray(view.finalScores));
});

test("getPhaseTimerEnd returns a planning-turn deadline, and forceReadyAndAdvance plays a random card for whoever's turn timed out", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  const before = engine.getPublicRoundView(room);
  assert.equal(before.round.phase, "planning");
  const timerEnd = engine.getPhaseTimerEnd!(room);
  assert.ok(typeof timerEnd === "number" && timerEnd! > Date.now());

  const currentId = before.round.currentPlayerId;
  const handBefore = engine.getPrivateView(room, currentId).hand.length;
  const stackBefore = before.round.stack.length;

  engine.forceReadyAndAdvance!(room);

  const after = engine.getPublicRoundView(room);
  // Se jugó (o robó) automáticamente por el jugador al que se le acabó el
  // tiempo — el turno ya no le sigue tocando a él (salvo que sea un
  // acelerar, cubierto por otro test) y la pila creció, o su mano cambió.
  const handAfter = engine.getPrivateView(room, currentId).hand.length;
  assert.ok(after.round.stack.length > stackBefore || handAfter !== handBefore);
});

test("getPhaseTimerEnd is null once the round moves into the action phase", () => {
  const room = makeRoom(3);
  engine.startRound(room);
  for (let i = 0; i < 200; i++) {
    const view = engine.getPublicRoundView(room);
    if (view.round.phase !== "planning") break;
    engine.handleAction(room, view.round.currentPlayerId, "draw_three", {});
  }
  const view = engine.getPublicRoundView(room);
  if (view.round.phase === "action") {
    assert.equal(engine.getPhaseTimerEnd!(room), null);
  }
});
