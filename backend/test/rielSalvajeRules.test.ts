const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  createInitialState,
  drawThreeInsteadOfPlaying,
  playPlanningCard,
  resolveNextAction,
  resolveRoundEvent,
  finishRound,
  currentPlanningPlayerId,
  currentTurnIcon,
  planningComplete,
  actionPhaseComplete,
  reachableShotTargets,
  clampWagonMove,
  computeFinalScores,
  HAND_SIZE,
  BUHO_HAND_SIZE,
  STARTING_BULLET_STOCK,
} = require("../src/games/riel-salvaje/rules");

function setup(characters: string[]) {
  return createInitialState(characters.map((character, i) => ({ id: `p${i + 1}`, character })));
}

// ─── Armado de partida ───────────────────────────────────────────────────────

test("createInitialState rejects fewer than 3 or more than 6 players", () => {
  assert.throws(() => setup(["vibora", "trueno"]));
  assert.throws(() => setup(["vibora", "trueno", "sombra", "buho", "dalia", "urraca", "vibora"]));
});

test("createInitialState rejects repeated characters", () => {
  assert.throws(() => setup(["vibora", "vibora", "sombra"]));
});

test("createInitialState deals 6 cards to everyone, 7 to Búho", () => {
  const state = setup(["vibora", "trueno", "buho"]);
  const vibora = state.players.find((p: any) => p.character === "vibora");
  const buho = state.players.find((p: any) => p.character === "buho");
  assert.equal(vibora.hand.length, HAND_SIZE);
  assert.equal(buho.hand.length, BUHO_HAND_SIZE);
});

test("createInitialState gives everyone a starting $250 bag and full bullet stock", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.players.forEach((p: any) => {
    assert.equal(p.cargo.length, 1);
    assert.equal(p.cargo[0].value, 250);
    assert.equal(p.ownBulletStock, STARTING_BULLET_STOCK);
  });
});

test("distributeCargo puts exactly 1 briefcase in the Locomotora, no bags/jewels beyond the 18+6 pool", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const allItems = state.train.flatMap((w: any) => [...w.interior.items, ...w.techo.items]);
  assert.ok(allItems.filter((i: any) => i.kind === "bolsa").length <= 18);
  assert.ok(allItems.filter((i: any) => i.kind === "joya").length <= 6);
  assert.equal(allItems.filter((i: any) => i.kind === "maletin").length, 1);
  assert.ok(state.train[0].interior.items.some((i: any) => i.kind === "maletin"));
});

test("every non-Locomotora wagon gets between 2 and 5 bags/jewels — not necessarily all 24 from the pool", () => {
  const state = setup(["vibora", "trueno", "sombra", "buho", "dalia", "urraca"]);
  const cargoWagons = state.train.filter((w: any) => !w.isLocomotora);
  for (const wagon of cargoWagons) {
    assert.ok(wagon.interior.items.length >= 2, `wagon ${wagon.index} has ${wagon.interior.items.length} items, expected >= 2`);
    assert.ok(wagon.interior.items.length <= 5, `wagon ${wagon.index} has ${wagon.interior.items.length} items, expected <= 5`);
  }
});

// ─── clampWagonMove ──────────────────────────────────────────────────────────

test("clampWagonMove never goes past either end of the train", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  assert.equal(clampWagonMove(state.train, 0, -5), 0);
  assert.equal(clampWagonMove(state.train, state.train.length - 1, 5), state.train.length - 1);
});

// ─── Mover ───────────────────────────────────────────────────────────────────

test("mover moves exactly 1 wagon in the interior, even if a larger distance is requested", () => {
  const state = setup(["vibora", "trueno", "sombra", "buho", "dalia"]);
  const player = state.players[0];
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  player.position = { wagonIndex: 2, layer: "interior" };
  state.train[2].interior.occupantIds.push(player.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "mover" }, faceDown: false, ownerId: player.id }];
  const res = resolveNextAction(state, { direction: 1, distance: 4 });
  const after = res.state.players.find((p: any) => p.id === player.id);
  assert.equal(after.position.wagonIndex, 3); // solo 1 vagón, no 4
});

test("mover can move several wagons at once from the roof, per DESIGN.md 4.1", () => {
  const state = setup(["vibora", "trueno", "sombra", "buho", "dalia"]);
  const player = state.players[0];
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  player.position = { wagonIndex: 1, layer: "techo" };
  state.train[1].techo.occupantIds.push(player.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "mover" }, faceDown: false, ownerId: player.id }];
  const res = resolveNextAction(state, { direction: 1, distance: 3 });
  const after = res.state.players.find((p: any) => p.id === player.id);
  assert.equal(after.position.wagonIndex, 4);
  // También sale de la lista de ocupantes del techo del vagón 1 y entra en la
  // del vagón 4.
  assert.ok(!res.state.train[1].techo.occupantIds.includes(player.id));
  assert.ok(res.state.train[4].techo.occupantIds.includes(player.id));
});

test("mover from the roof never pushes past the end of the train even with a huge requested distance", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const player = state.players[0];
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  player.position = { wagonIndex: 1, layer: "techo" };
  state.train[1].techo.occupantIds.push(player.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "mover" }, faceDown: false, ownerId: player.id }];
  const res = resolveNextAction(state, { direction: 1, distance: 999 });
  const after = res.state.players.find((p: any) => p.id === player.id);
  assert.equal(after.position.wagonIndex, state.train.length - 1);
});

// ─── Fase Planificación ──────────────────────────────────────────────────────

test("playPlanningCard rejects a card played out of turn", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const currentId = currentPlanningPlayerId(state);
  const otherPlayer = state.players.find((p: any) => p.id !== currentId);
  const res = playPlanningCard(state, otherPlayer.id, otherPlayer.hand[0].id);
  assert.ok(res.error);
});

test("a Túnel turn is always played face down, even for a non-Sombra character", () => {
  // "gancho_de_correo" tiene el turno 2 en Túnel — con 3 jugadores hacen
  // falta las 3 cartas del turno 1 (boca_arriba) antes de que empiece el 2.
  let state = setup(["vibora", "trueno", "sombra"]);
  state.round.cardId = "gancho_de_correo";
  for (let i = 0; i < 3; i++) {
    const playerId = currentPlanningPlayerId(state)!;
    const res = playPlanningCard(state, playerId, state.players.find((p: any) => p.id === playerId).hand[0].id);
    assert.ok(!res.error, res.error);
    state = res.state;
  }
  assert.equal(currentTurnIcon(state), "tunel");
  const nextPlayerId = currentPlanningPlayerId(state)!;
  const res = playPlanningCard(state, nextPlayerId, state.players.find((p: any) => p.id === nextPlayerId).hand[0].id);
  assert.equal(res.state.round.stack[3].faceDown, true);
});

test("Sombra plays face down on her own first turn of the round even on a boca_arriba icon, unless she draws instead", () => {
  const s1 = setup(["sombra", "trueno", "vibora"]);
  s1.round.cardId = "freno"; // los 4 turnos son boca_arriba
  s1.round.turnOrder = ["p1", "p2", "p3"]; // p1 = sombra, primer turno
  const sombra = s1.players.find((p: any) => p.character === "sombra");
  const r1 = playPlanningCard(s1, "p1", sombra.hand[0].id);
  assert.equal(r1.state.round.stack[0].faceDown, true);
});

test("Sombra loses the ability for the round if she draws 3 on her first turn instead of playing", () => {
  const s1 = setup(["sombra", "trueno", "vibora"]);
  s1.round.cardId = "freno";
  s1.round.turnOrder = ["p1", "p2", "p3"];
  const r1 = drawThreeInsteadOfPlaying(s1, "p1");
  const sombraAfter = r1.state.players.find((p: any) => p.character === "sombra");
  assert.equal(sombraAfter.sombraFirstTurnPlayed, true);
  assert.equal(sombraAfter.hand.length, HAND_SIZE + 3);
});

test("acelerar makes the same player play twice before the turn passes on", () => {
  const s1 = setup(["vibora", "trueno", "sombra"]);
  s1.round.cardId = "a_por_todas"; // turno 3 es acelerar
  s1.round.turnOrder = ["p1", "p2", "p3"];
  s1.round.turnsCompleted = 2; // ya se jugaron los turnos 1 y 2
  s1.round.currentPlayerIndex = 0;
  const p1 = s1.players.find((p: any) => p.id === "p1");
  const r1 = playPlanningCard(s1, "p1", p1.hand[0].id);
  assert.equal(currentPlanningPlayerId(r1.state), "p1"); // sigue siendo su turno
  const p1After = r1.state.players.find((p: any) => p.id === "p1");
  const r2 = playPlanningCard(r1.state, "p1", p1After.hand[0].id);
  assert.equal(currentPlanningPlayerId(r2.state), "p2"); // ahora sí pasa
});

test("cambio_de_via restarts the turn order from the Jugador Inicial", () => {
  const s1 = setup(["vibora", "trueno", "sombra"]);
  s1.round.cardId = "marshal_furioso"; // turno 4 es cambio_de_via
  s1.round.turnOrder = ["p1", "p2", "p3"];
  s1.round.turnsCompleted = 3;
  s1.round.currentPlayerIndex = 2; // le tocaba a p3 antes del cambio
  const p3 = s1.players.find((p: any) => p.id === "p3");
  const r1 = playPlanningCard(s1, "p3", p3.hand[0].id);
  assert.equal(r1.state.round.phase, "action");
});

test("planning phase ends once every turn of the round card is played", () => {
  const s1 = setup(["vibora", "trueno", "sombra"]);
  s1.round.cardId = "freno"; // 4 turnos, todos boca_arriba
  s1.round.turnOrder = ["p1", "p2", "p3"];
  let state = s1;
  // 4 turnos * 3 jugadores = 12 cartas para completar Planificación.
  for (let i = 0; i < 12; i++) {
    assert.equal(planningComplete(state), false);
    const playerId = currentPlanningPlayerId(state)!;
    const player = state.players.find((p: any) => p.id === playerId);
    const res = playPlanningCard(state, playerId, player.hand[0].id);
    assert.ok(!res.error, res.error);
    state = res.state;
  }
  assert.equal(state.round.phase, "action");
});

// ─── Disparo y línea de visión ───────────────────────────────────────────────

test("shooting from the interior only reaches an adjacent wagon's interior", () => {
  const state = setup(["vibora", "trueno", "sombra", "buho"]);
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  // train: 0=Locomotora,1..4 vagones. Ponemos a p1 en interior del vagón 2.
  state.players[0].position = { wagonIndex: 2, layer: "interior" };
  state.train[2].interior.occupantIds.push("p1");
  state.players[1].position = { wagonIndex: 3, layer: "interior" };
  state.train[3].interior.occupantIds.push("p2");
  state.players[2].position = { wagonIndex: 4, layer: "interior" };
  state.train[4].interior.occupantIds.push("p3");
  const targets = reachableShotTargets(state, "p1");
  assert.ok(targets.includes("p2"));
  assert.ok(!targets.includes("p3"));
});

test("shooting from the roof is blocked by the nearest occupied roof in that direction", () => {
  const state = setup(["vibora", "trueno", "sombra", "buho"]);
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  state.players[0].position = { wagonIndex: 1, layer: "techo" };
  state.train[1].techo.occupantIds.push("p1");
  state.players[1].position = { wagonIndex: 2, layer: "techo" };
  state.train[2].techo.occupantIds.push("p2");
  state.players[2].position = { wagonIndex: 3, layer: "techo" };
  state.train[3].techo.occupantIds.push("p3");
  const targets = reachableShotTargets(state, "p1");
  assert.deepEqual(targets, ["p2"]); // p3 queda bloqueado por p2
});

test("Víbora can shoot within her own wagon across layers, the one exception to the rule", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const vibora = state.players.find((p: any) => p.character === "vibora");
  const other = state.players.find((p: any) => p.character !== "vibora");
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
    w.techo.occupantIds = [];
  });
  vibora.position = { wagonIndex: 1, layer: "interior" };
  other.position = { wagonIndex: 1, layer: "techo" };
  state.train[1].interior.occupantIds.push(vibora.id);
  state.train[1].techo.occupantIds.push(other.id);
  const targets = reachableShotTargets(state, vibora.id);
  assert.ok(targets.includes(other.id));
});

test("resolveNextAction: a shot consumes the shooter's own bullet stock and hands the target a bullet card", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const shooter = state.players[0];
  const target = state.players[1];
  target.position = { wagonIndex: shooter.position.wagonIndex, layer: shooter.position.layer === "interior" ? "techo" : "interior" };
  // Reacomodamos para que sea un tiro válido simple: ambos en el techo de
  // vagones adyacentes.
  shooter.position = { wagonIndex: 1, layer: "techo" };
  target.position = { wagonIndex: 2, layer: "techo" };
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  state.train[1].techo.occupantIds.push(shooter.id);
  state.train[2].techo.occupantIds.push(target.id);
  state.round.phase = "action";
  const shotCard = shooter.hand.find((c: any) => c.kind === "disparar") ?? { id: "x", kind: "disparar" };
  state.round.stack = [{ card: shotCard, faceDown: false, ownerId: shooter.id }];
  const res = resolveNextAction(state, { targetId: target.id });
  assert.ok(!res.error, res.error);
  const shooterAfter = res.state.players.find((p: any) => p.id === shooter.id);
  const targetAfter = res.state.players.find((p: any) => p.id === target.id);
  assert.equal(shooterAfter.ownBulletStock, STARTING_BULLET_STOCK - 1);
  assert.ok(targetAfter.discardPile.some((c: any) => c.kind === "bala"));
  assert.equal(targetAfter.bulletsReceivedTotal, 1);
});

test("Trueno's shot always pushes the target back — the shot is rejected without a chosen direction", () => {
  const state = setup(["trueno", "vibora", "sombra"]);
  const shooter = state.players[0];
  const target = state.players[1];
  shooter.position = { wagonIndex: 1, layer: "techo" };
  target.position = { wagonIndex: 2, layer: "techo" };
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  state.train[1].techo.occupantIds.push(shooter.id);
  state.train[2].techo.occupantIds.push(target.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "disparar" }, faceDown: false, ownerId: shooter.id }];

  const withoutDirection = resolveNextAction(state, { targetId: target.id });
  assert.ok(withoutDirection.error);

  const res = resolveNextAction(state, { targetId: target.id, direction: 1 });
  assert.ok(!res.error, res.error);
  const targetAfter = res.state.players.find((p: any) => p.id === target.id);
  assert.equal(targetAfter.position.wagonIndex, 3); // empujado 1 vagón hacia la cola
  assert.ok(targetAfter.discardPile.some((c: any) => c.kind === "bala")); // además recibe la bala
});

test("Trueno's push never pushes the target off the train", () => {
  const state = setup(["trueno", "vibora", "sombra"]);
  const shooter = state.players[0];
  const target = state.players[1];
  const lastWagon = state.train.length - 1;
  shooter.position = { wagonIndex: lastWagon - 1, layer: "techo" };
  target.position = { wagonIndex: lastWagon, layer: "techo" };
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  state.train[lastWagon - 1].techo.occupantIds.push(shooter.id);
  state.train[lastWagon].techo.occupantIds.push(target.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "disparar" }, faceDown: false, ownerId: shooter.id }];
  const res = resolveNextAction(state, { targetId: target.id, direction: 1 }); // empuja hacia la cola, ya en el último vagón
  assert.ok(!res.error, res.error);
  const targetAfter = res.state.players.find((p: any) => p.id === target.id);
  assert.equal(targetAfter.position.wagonIndex, lastWagon);
});

// ─── Golpear / Urraca ────────────────────────────────────────────────────────

test("Urraca picks up a bag her victim drops from a punch immediately, instead of leaving it on the floor", () => {
  const state = setup(["urraca", "trueno", "sombra"]);
  const urraca = state.players.find((p: any) => p.character === "urraca");
  const victim = state.players.find((p: any) => p.character !== "urraca");
  victim.cargo.push({ id: "bag1", kind: "bolsa", value: 300 });
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  urraca.position = { wagonIndex: 1, layer: "interior" };
  victim.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(urraca.id, victim.id);
  state.round.phase = "action";
  const punchCard = { id: "x", kind: "golpear" };
  state.round.stack = [{ card: punchCard, faceDown: false, ownerId: urraca.id }];
  const res = resolveNextAction(state, { targetId: victim.id, itemId: "bag1", pushDirection: 1 });
  assert.ok(!res.error, res.error);
  const urracaAfter = res.state.players.find((p: any) => p.id === urraca.id);
  const victimAfter = res.state.players.find((p: any) => p.id === victim.id);
  assert.ok(urracaAfter.cargo.some((i: any) => i.id === "bag1"));
  assert.ok(!victimAfter.cargo.some((i: any) => i.id === "bag1"));
  // La víctima no debería recuperar la bolsa del piso — ya está en manos de Urraca.
  const bagOnFloor = res.state.train.flatMap((w: any) => [...w.interior.items, ...w.techo.items]).some((i: any) => i.id === "bag1");
  assert.equal(bagOnFloor, false);
});

test("a non-Urraca attacker leaves the dropped bag on the wagon floor instead", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const attacker = state.players[0];
  const victim = state.players[1];
  victim.cargo.push({ id: "bag1", kind: "bolsa", value: 300 });
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  attacker.position = { wagonIndex: 1, layer: "interior" };
  victim.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(attacker.id, victim.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "golpear" }, faceDown: false, ownerId: attacker.id }];
  const res = resolveNextAction(state, { targetId: victim.id, itemId: "bag1", pushDirection: 1 });
  const bagOnFloor = res.state.train.flatMap((w: any) => [...w.interior.items, ...w.techo.items]).some((i: any) => i.id === "bag1");
  assert.equal(bagOnFloor, true);
});

// ─── Dalia ────────────────────────────────────────────────────────────────

test("Dalia cannot be targeted by a shot while another valid target is in range", () => {
  const state = setup(["dalia", "trueno", "sombra"]);
  const shooter = state.players.find((p: any) => p.character === "trueno");
  const dalia = state.players.find((p: any) => p.character === "dalia");
  const other = state.players.find((p: any) => p.character === "sombra");
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  shooter.position = { wagonIndex: 1, layer: "techo" };
  dalia.position = { wagonIndex: 2, layer: "techo" };
  other.position = { wagonIndex: 2, layer: "techo" };
  state.train[1].techo.occupantIds.push(shooter.id);
  state.train[2].techo.occupantIds.push(dalia.id, other.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "disparar" }, faceDown: false, ownerId: shooter.id }];
  const res = resolveNextAction(state, { targetId: dalia.id });
  assert.ok(res.error);
});

// ─── Nunca se abandona el tren ───────────────────────────────────────────────

test("a forced push at the tail end of the train does not push the victim off", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const attacker = state.players[0];
  const victim = state.players[1];
  const lastWagon = state.train.length - 1;
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  attacker.position = { wagonIndex: lastWagon, layer: "interior" };
  victim.position = { wagonIndex: lastWagon, layer: "interior" };
  state.train[lastWagon].interior.occupantIds.push(attacker.id, victim.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "golpear" }, faceDown: false, ownerId: attacker.id }];
  const res = resolveNextAction(state, { targetId: victim.id, pushDirection: 1 });
  const victimAfter = res.state.players.find((p: any) => p.id === victim.id);
  assert.equal(victimAfter.position.wagonIndex, lastWagon);
});

test("golpear is rejected without an explicit push direction — the push is mandatory, not optional", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const attacker = state.players[0];
  const victim = state.players[1];
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  attacker.position = { wagonIndex: 1, layer: "interior" };
  victim.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(attacker.id, victim.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "golpear" }, faceDown: false, ownerId: attacker.id }];
  const res = resolveNextAction(state, { targetId: victim.id });
  assert.ok(res.error);
});

// ─── Marshal ─────────────────────────────────────────────────────────────────

test("a bandit who ends up sharing the Marshal's wagon is bumped to the roof and gets a neutral bullet", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const player = state.players[0];
  state.marshal.position = { wagonIndex: 2, layer: "interior" };
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  player.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(player.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "mover" }, faceDown: false, ownerId: player.id }];
  const res = resolveNextAction(state, { direction: 1 });
  const after = res.state.players.find((p: any) => p.id === player.id);
  assert.deepEqual(after.position, { wagonIndex: 2, layer: "techo" });
  assert.ok(after.discardPile.some((c: any) => c.kind === "bala"));
});

test("the shared neutral bullet deck runs out and stops handing out bullets, without crashing", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.sharedNeutralBulletsRemaining = 0;
  const player = state.players[0];
  state.marshal.position = { wagonIndex: 2, layer: "interior" };
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  player.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(player.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "mover" }, faceDown: false, ownerId: player.id }];
  const res = resolveNextAction(state, { direction: 1 });
  const after = res.state.players.find((p: any) => p.id === player.id);
  assert.equal(after.discardPile.length, 0);
  assert.equal(res.state.sharedNeutralBulletsRemaining, 0);
});

// ─── Eventos de fin de ronda ─────────────────────────────────────────────────

test("Marshal furioso shoots every bandit on the roof of his own wagon and always moves toward the tail", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.round.cardId = "marshal_furioso";
  state.marshal.position = { wagonIndex: 1, layer: "interior" };
  state.train.forEach((w: any) => {
    w.techo.occupantIds = [];
  });
  state.players[0].position = { wagonIndex: 1, layer: "techo" };
  state.train[1].techo.occupantIds.push(state.players[0].id);
  const res = resolveRoundEvent(state);
  const after = res.players.find((p: any) => p.id === state.players[0].id);
  assert.ok(after.discardPile.some((c: any) => c.kind === "bala"));
  assert.equal(res.marshal.position.wagonIndex, 2);
});

test("carterismo lets a lone bandit take a free bag from their spot, but not a jewel", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.round.cardId = "carterismo";
  const player = state.players[0];
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
    w.interior.items = [];
  });
  player.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(player.id);
  state.train[1].interior.items.push({ id: "jewel1", kind: "joya", value: 500 }, { id: "bag1", kind: "bolsa", value: 300 });
  const res = resolveRoundEvent(state);
  const after = res.players.find((p: any) => p.id === player.id);
  assert.ok(after.cargo.some((i: any) => i.id === "bag1"));
  assert.ok(!after.cargo.some((i: any) => i.id === "jewel1"));
});

test("llevatelo_todo places the second briefcase in the Marshal's current wagon, only once", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.round.cardId = "a_por_todas";
  state.marshal.position = { wagonIndex: 3, layer: "interior" };
  const res = resolveRoundEvent(state);
  assert.equal(res.secondBriefcasePlaced, true);
  assert.ok(res.train[3].interior.items.some((i: any) => i.kind === "maletin"));
  const res2 = resolveRoundEvent(res);
  const briefcaseCount = res2.train
    .flatMap((w: any) => [...w.interior.items, ...w.techo.items])
    .filter((i: any) => i.kind === "maletin").length;
  // 2 en total: el primero (Locomotora, de distributeCargo) + el segundo
  // que agregó el evento — no se agrega un tercero si el evento saliera de
  // nuevo.
  assert.equal(briefcaseCount, 2);
});

// ─── Cierre de partida ───────────────────────────────────────────────────────

test("finishRound doesn't lose cards a player never got around to playing that round", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const player = state.players[0];
  const totalCardsBefore = player.hand.length + player.drawPile.length + player.discardPile.length;
  // Nadie jugó nada esta ronda — toda la mano queda "sin jugar".
  const res = finishRound(state);
  const after = res.players.find((p: any) => p.id === player.id);
  const totalCardsAfter = after.hand.length + after.drawPile.length + after.discardPile.length;
  assert.equal(totalCardsAfter, totalCardsBefore);
});

test("finishRound rotates the Jugador Inicial to the next seat", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const seatOrder = state.players.map((p: any) => p.id);
  state.round.turnOrder = [seatOrder[0], seatOrder[1], seatOrder[2]];
  const res = finishRound(state);
  assert.equal(res.round.turnOrder[0], seatOrder[1]);
  assert.equal(res.round.roundNumber, 2);
});

test("finishRound on round 5 ends the game and computes final scores", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.round.roundNumber = 5;
  const res = finishRound(state);
  assert.equal(res.stage, "finished");
  assert.ok(Array.isArray(res.winnerIds) && res.winnerIds.length > 0);
});

test("Título de Pistolero: everyone tied for fewest own bullets left gets the $1000 bonus", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.players[0].ownBulletStock = 2;
  state.players[1].ownBulletStock = 2;
  state.players[2].ownBulletStock = 4;
  const scores = computeFinalScores(state);
  assert.equal(scores.find((s: any) => s.playerId === state.players[0].id).pistolero, true);
  assert.equal(scores.find((s: any) => s.playerId === state.players[1].id).pistolero, true);
  assert.equal(scores.find((s: any) => s.playerId === state.players[2].id).pistolero, false);
});

test("game-end tie in total loot is broken by whoever received fewer bullets during the game", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  state.players.forEach((p: any) => {
    p.cargo = [{ id: "x", kind: "bolsa", value: 500 }];
  });
  state.players[0].bulletsReceivedTotal = 3;
  state.players[1].bulletsReceivedTotal = 1;
  state.players[2].bulletsReceivedTotal = 5;
  state.round.roundNumber = 5;
  const res = finishRound(state);
  assert.deepEqual(res.winnerIds, [state.players[1].id]);
});

test("bulletsReceivedTotal (used for the tiebreak) counts neutral/event bullets too, not just ones from other players", () => {
  const state = setup(["vibora", "trueno", "sombra"]);
  const player = state.players[0];
  state.marshal.position = { wagonIndex: 2, layer: "interior" };
  state.train.forEach((w: any) => {
    w.interior.occupantIds = [];
  });
  player.position = { wagonIndex: 1, layer: "interior" };
  state.train[1].interior.occupantIds.push(player.id);
  state.round.phase = "action";
  state.round.stack = [{ card: { id: "x", kind: "mover" }, faceDown: false, ownerId: player.id }];
  // Se mueve al vagón del Marshal — el Marshal le da una bala neutral
  // (DESIGN.md 2), que el desempate de fin de partida (4.5) también debe
  // contar ("de otros jugadores y de eventos").
  const res = resolveNextAction(state, { direction: 1 });
  const after = res.state.players.find((p: any) => p.id === player.id);
  assert.equal(after.bulletsReceivedTotal, 1);
});

// ─── Partida completa de punta a punta (red de seguridad) ───────────────────

test("a full 5-round game runs end to end without throwing, always drawing 3 instead of playing", () => {
  let state = setup(["vibora", "trueno", "sombra", "buho"]);
  for (let round = 0; round < 5; round++) {
    while (!planningComplete(state)) {
      const playerId = currentPlanningPlayerId(state)!;
      const res = drawThreeInsteadOfPlaying(state, playerId);
      assert.ok(!res.error, res.error);
      state = res.state;
    }
    while (!actionPhaseComplete(state)) {
      const res = resolveNextAction(state);
      assert.ok(!res.error, res.error);
      state = res.state;
    }
    state = resolveRoundEvent(state);
    state = finishRound(state);
  }
  assert.equal(state.stage, "finished");
  assert.ok(Array.isArray(state.winnerIds));
});
