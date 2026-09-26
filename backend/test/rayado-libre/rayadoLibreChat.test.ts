// ─── Rayado Libre chat: "escribiendo…" and "cerca" ──────────────────────────
// Engine-level coverage for the two chat additions (see engine.ts's "typing"
// action and closeEntryIds). The privacy guarantee — a "close" mark never
// reaching anyone but its author — is checked on every view the engine can
// produce (public view and every other player's private view).

const { test } = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../../src/games/rayado-libre/engine");
const { TYPING_TTL_MS } = require("@juntada/rayado-libre-scoring");

interface TestPlayer {
  id: string;
  name: string;
  ready: boolean;
  online: boolean;
}

function makeDrawingRoom(word = "Mariposa") {
  const room: any = {
    code: "TEST1",
    players: [
      { id: "p1", name: "Ana", ready: false, online: true },
      { id: "p2", name: "Beto", ready: false, online: true },
      { id: "p3", name: "Caro", ready: false, online: true },
    ] as TestPlayer[],
    config: engine.createConfig(),
    round: null,
    usedWords: {},
    roundHistory: [],
  };
  room.config.customWords = [word];
  engine.startRound(room);
  // A one-word pool offers that same word three times — pick it.
  engine.handleAction(room, room.round.drawerId, "choose_word", { word });
  const drawerId: string = room.round.drawerId;
  const [g1, g2] = room.players.filter((p: TestPlayer) => p.id !== drawerId).map((p: TestPlayer) => p.id);
  return { room, drawerId, g1, g2 };
}

// ─── typing ───

test("typing marks a guesser as typing for TYPING_TTL_MS in the public view", () => {
  const { room, g1 } = makeDrawingRoom();
  const before = Date.now();
  const res = engine.handleAction(room, g1, "typing", {});
  assert.deepEqual(res, { handled: true });

  const until = engine.getPublicRoundView(room).typingUntil[g1];
  assert.ok(until >= before + TYPING_TTL_MS && until <= Date.now() + TYPING_TTL_MS);
});

test("an expired typing mark is filtered out of the public view (no server timer needed)", () => {
  const { room, g1, g2 } = makeDrawingRoom();
  engine.handleAction(room, g1, "typing", {});
  engine.handleAction(room, g2, "typing", {});
  room.round.typingUntil[g1] = Date.now() - 1;

  assert.deepEqual(Object.keys(engine.getPublicRoundView(room).typingUntil), [g2]);
});

test("typing is ignored (no error, nothing to broadcast) for the drawer and for someone who already guessed", () => {
  const { room, drawerId, g1 } = makeDrawingRoom();
  assert.deepEqual(engine.handleAction(room, drawerId, "typing", {}), { handled: true, unchanged: true });

  engine.handleAction(room, g1, "guess", { text: "Mariposa" });
  assert.deepEqual(engine.handleAction(room, g1, "typing", {}), { handled: true, unchanged: true });
  assert.deepEqual(engine.getPublicRoundView(room).typingUntil, {});
});

test("typing is ignored outside the drawing phase", () => {
  const { room, g1 } = makeDrawingRoom();
  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "reveal");
  assert.deepEqual(engine.handleAction(room, g1, "typing", {}), { handled: true, unchanged: true });
});

test("sending any guess (wrong or right) clears that player's typing mark", () => {
  const { room, g1, g2 } = makeDrawingRoom();
  engine.handleAction(room, g1, "typing", {});
  engine.handleAction(room, g2, "typing", {});

  engine.handleAction(room, g1, "guess", { text: "perro" });
  assert.deepEqual(Object.keys(engine.getPublicRoundView(room).typingUntil), [g2]);

  engine.handleAction(room, g2, "guess", { text: "Mariposa" });
  assert.deepEqual(engine.getPublicRoundView(room).typingUntil, {});
});

test("a typing mark set just before someone guessed right never shows for them", () => {
  const { room, g1 } = makeDrawingRoom();
  room.round.typingUntil[g1] = Date.now() + TYPING_TTL_MS;
  room.round.correctGuessers.push(g1);
  assert.deepEqual(engine.getPublicRoundView(room).typingUntil, {});
});

test("a new turn starts with nobody typing", () => {
  const { room, g1, g2 } = makeDrawingRoom();
  engine.handleAction(room, g1, "typing", {});
  engine.handleAction(room, g1, "guess", { text: "Mariposa" });
  engine.handleAction(room, g2, "typing", {});
  engine.handleAction(room, g2, "guess", { text: "Mariposa" });
  room.players.forEach((p: TestPlayer) => engine.handleAction(room, p.id, "player_ready", {}));
  assert.equal(room.phase, "choosing");
  assert.deepEqual(room.round.typingUntil, {});
});

// ─── chat ids ───

test("every chat entry gets a monotonically increasing id", () => {
  const { room, g1, g2 } = makeDrawingRoom();
  engine.handleAction(room, g1, "guess", { text: "perro" });
  engine.handleAction(room, g2, "guess", { text: "gato" });
  engine.handleAction(room, g1, "guess", { text: "Mariposa" });
  const ids = room.round.chatLog.map((e: { id: number }) => e.id);
  assert.deepEqual(ids, [1, 2, 3]);
});

test("the chat log keeps the last 100 entries", () => {
  const { room, g1 } = makeDrawingRoom();
  for (let i = 0; i < 105; i++) engine.handleAction(room, g1, "guess", { text: `intento ${i}` });
  assert.equal(room.round.chatLog.length, 100);
  assert.equal(room.round.chatLog[0].text, "intento 5");
  assert.equal(room.round.chatLog.at(-1).id, 105);
});

test("migrateRound gives ids to entries from a snapshot saved before chat ids existed", () => {
  const { room, g1 } = makeDrawingRoom();
  room.round.chatLog = [
    { type: "chat", playerId: g1, text: "perro" },
    { type: "chat", playerId: g1, text: "gato" },
  ];
  delete room.round.chatSeq;
  delete room.round.typingUntil;
  delete room.round.closeEntryIds;

  engine.migrateRound(room);
  assert.deepEqual(
    room.round.chatLog.map((e: { id: number }) => e.id),
    [1, 2],
  );
  assert.deepEqual(room.round.typingUntil, {});
  assert.deepEqual(room.round.closeEntryIds, {});
  engine.handleAction(room, g1, "guess", { text: "pez" });
  assert.equal(room.round.chatLog.at(-1).id, 3);
});

// ─── close ───

test("a close wrong guess is logged as a normal chat entry and marked close for its author only", () => {
  const { room, g1 } = makeDrawingRoom();
  const res = engine.handleAction(room, g1, "guess", { text: "maripos" });
  // rerolled: the author's private view changed, so private_role must go out.
  assert.deepEqual(res, { handled: true, rerolled: true });
  const entry = room.round.chatLog.at(-1);
  assert.deepEqual(entry, { id: entry.id, type: "chat", playerId: g1, text: "maripos" });
  assert.deepEqual(engine.getPrivateView(room, g1).closeEntryIds, [entry.id]);
});

test("a prefix of 4+ letters is close; an unrelated wrong guess is not (and needs no private push)", () => {
  const { room, g1 } = makeDrawingRoom();
  assert.deepEqual(engine.handleAction(room, g1, "guess", { text: "mari" }), { handled: true, rerolled: true });
  assert.deepEqual(engine.handleAction(room, g1, "guess", { text: "perro" }), { handled: true });
  assert.equal(engine.getPrivateView(room, g1).closeEntryIds.length, 1);
});

test("'close' never reaches other players — not in the public view, not in anyone else's private view", () => {
  const { room, drawerId, g1, g2 } = makeDrawingRoom();
  engine.handleAction(room, g1, "guess", { text: "maripoza" });

  const publicJson = JSON.stringify(engine.getPublicRoundView(room));
  assert.ok(!publicJson.includes("close"), `public view leaked a close mark: ${publicJson}`);
  assert.deepEqual(engine.getPrivateView(room, g2).closeEntryIds, []);
  assert.deepEqual(engine.getPrivateView(room, drawerId).closeEntryIds, []);

  // Still private in the reveal recap.
  engine.forceReadyAndAdvance(room);
  assert.equal(room.phase, "reveal");
  assert.ok(!JSON.stringify(engine.getPublicRoundView(room)).includes("close"));
  assert.deepEqual(engine.getPrivateView(room, g2).closeEntryIds, []);
  assert.equal(engine.getPrivateView(room, g1).closeEntryIds.length, 1);
});

test("close marks are cleared for the next turn and pruned when their entry falls off the log", () => {
  const { room, g1 } = makeDrawingRoom();
  engine.handleAction(room, g1, "guess", { text: "maripos" });
  for (let i = 0; i < 100; i++) engine.handleAction(room, g1, "guess", { text: `intento ${i}` });
  assert.deepEqual(engine.getPrivateView(room, g1).closeEntryIds, []);

  engine.handleAction(room, g1, "guess", { text: "maripos" });
  engine.forceReadyAndAdvance(room);
  room.players.forEach((p: TestPlayer) => engine.handleAction(room, p.id, "player_ready", {}));
  assert.equal(room.phase, "choosing");
  assert.deepEqual(room.round.closeEntryIds, {});
});

// ─── guessedWord ───

test("only players who already guessed get the word (as guessedWord) in their private view", () => {
  const { room, drawerId, g1, g2 } = makeDrawingRoom();
  engine.handleAction(room, g1, "guess", { text: "maripos" });
  assert.equal(engine.getPrivateView(room, g1).guessedWord, undefined);

  engine.handleAction(room, g1, "guess", { text: "Mariposa" });
  assert.equal(engine.getPrivateView(room, g1).guessedWord, "Mariposa");
  assert.equal(engine.getPrivateView(room, g2).guessedWord, undefined);
  assert.equal(engine.getPrivateView(room, g2).word, undefined);
  assert.equal(engine.getPrivateView(room, drawerId).guessedWord, undefined);
  assert.ok(!JSON.stringify(engine.getPublicRoundView(room)).includes("Mariposa"));
});
