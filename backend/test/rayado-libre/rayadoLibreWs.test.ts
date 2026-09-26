// ─── Rayado Libre WS Integration Test ───────────────────────────────────────
// Boots the real HTTP+WebSocket server (same approach as wsServer.test.ts)
// and drives a full 3-player game through actual sockets. Exists because a
// real bug (the new drawer's word choices never arriving after the second
// turn) only showed up at the transport layer — the engine's own unit tests
// (rayadoLibreEngine.test.ts) call handleAction directly and can't catch a
// missing `rerolled` flag, since that flag only matters to the WS handler
// that decides whether to re-send private_role to every socket.

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");
const { installFakeAuthService, registerTestAccount, jwtProtocol } = require("../wsAuthTestUtils");

installFakeAuthService();

const { createApp } = require("../../src/app");
const { CATEGORIES } = require("@juntada/rayado-libre-data");

type WSClient = import("ws").WebSocket;
interface Connected {
  ws: WSClient;
  queue: any[];
  playerId: string;
}

let server: import("http").Server;
let wsUrl: string;

before(async () => {
  server = createApp();
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  wsUrl = `ws://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  const { rooms, groups, clients } = require("../../src/state/roomStore");
  rooms.clear();
  groups.clear();
  clients.clear();
});

function openSocketWithQueue(protocols?: string[]): Promise<{ ws: WSClient; queue: any[] }> {
  return new Promise((resolve, reject) => {
    const ws = protocols ? new WebSocket(wsUrl, protocols) : new WebSocket(wsUrl);
    const queue: any[] = [];
    ws.on("message", (data: Buffer) => queue.push(JSON.parse(data.toString())));
    ws.once("open", () => resolve({ ws, queue }));
    ws.once("error", reject);
  });
}

// Polls a socket's message queue until `pred` matches one of the messages
// already received, or times out — messages can't be "await"ed one at a time
// here since several may arrive for a single action (state + private_role).
function waitFor(queue: any[], pred: (m: any) => boolean, timeoutMs = 2000): Promise<any> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const found = queue.find(pred);
      if (found) return resolve(found);
      if (Date.now() - start > timeoutMs) return reject(new Error("waitFor timed out"));
      setTimeout(check, 10);
    };
    check();
  });
}

async function createRoom(username: string): Promise<Connected & { roomCode: string }> {
  const { token } = registerTestAccount(username);
  const { ws, queue } = await openSocketWithQueue(jwtProtocol(token));
  ws.send(JSON.stringify({ type: "create_room", gameType: "rayado-libre" }));
  const joined = await waitFor(queue, m => m.type === "joined");
  return { ws, queue, playerId: joined.playerId, roomCode: joined.roomCode };
}

async function joinRoom(username: string, code: string): Promise<Connected> {
  const { token } = registerTestAccount(username);
  const { ws, queue } = await openSocketWithQueue(jwtProtocol(token));
  ws.send(JSON.stringify({ type: "join_room", code }));
  const joined = await waitFor(queue, m => m.type === "joined");
  return { ws, queue, playerId: joined.playerId };
}

test("the second drawer actually receives their word choices over the wire", async () => {
  const host = await createRoom("Ana");
  const p2 = await joinRoom("Beto", host.roomCode);
  const p3 = await joinRoom("Caro", host.roomCode);
  const players = [host, p2, p3];

  const allCats = Object.keys(CATEGORIES).reduce((a: Record<string, boolean>, k: string) => ({ ...a, [k]: true }), {});
  host.ws.send(JSON.stringify({ type: "update_config", config: { enabledCategories: allCats } }));
  await waitFor(host.queue, m => m.type === "state" && m.room.config.enabledCategories[Object.keys(CATEGORIES)[0]] === true);

  host.ws.send(JSON.stringify({ type: "start_round" }));
  const firstChoosingState = await waitFor(host.queue, m => m.type === "state" && m.room.phase === "choosing");
  const firstDrawerId = firstChoosingState.room.round.drawerId;
  const firstDrawer = players.find(p => p.playerId === firstDrawerId)!;
  const firstGuessers = players.filter(p => p.playerId !== firstDrawerId);

  const firstPrivateRole = await waitFor(firstDrawer.queue, m => m.type === "private_role" && Array.isArray(m.wordChoices));
  assert.equal(firstPrivateRole.wordChoices.length, 3);
  const firstWord = firstPrivateRole.wordChoices[0];

  firstDrawer.ws.send(JSON.stringify({ type: "choose_word", word: firstWord }));
  await waitFor(firstDrawer.queue, m => m.type === "state" && m.room.phase === "drawing");

  // Both non-drawer players guess correctly — that alone (no timer needed)
  // ends the drawing phase early and moves everyone into "reveal".
  for (const guesser of firstGuessers) {
    guesser.ws.send(JSON.stringify({ type: "guess", text: firstWord }));
  }
  await waitFor(host.queue, m => m.type === "state" && m.room.phase === "reveal");

  // Everyone confirms ready — this is what used to silently swallow the new
  // drawer's private_role message (see the "rerolled" comment in engine.ts).
  for (const p of players) {
    p.ws.send(JSON.stringify({ type: "player_ready" }));
  }
  const secondChoosingState = await waitFor(
    host.queue,
    m => m.type === "state" && m.room.phase === "choosing" && m.room.round.drawerId !== firstDrawerId,
  );
  const secondDrawerId = secondChoosingState.room.round.drawerId;
  const secondDrawer = players.find(p => p.playerId === secondDrawerId)!;

  // The bug: without `rerolled: true` on player_ready, this next line would
  // time out — no fresh private_role for the new drawer was ever sent.
  const secondPrivateRole = await waitFor(
    secondDrawer.queue,
    m => m.type === "private_role" && Array.isArray(m.wordChoices) && m.wordChoices.length === 3,
  );
  assert.equal(secondPrivateRole.isDrawer, true);
  assert.equal(secondPrivateRole.wordChoices.length, 3);

  for (const p of players) p.ws.close();
});

test("typing and 'close' over the wire: others see who's typing, but only the author ever gets the close mark", async () => {
  const host = await createRoom("Ana");
  const p2 = await joinRoom("Beto", host.roomCode);
  const p3 = await joinRoom("Caro", host.roomCode);
  const players = [host, p2, p3];

  const allCats = Object.keys(CATEGORIES).reduce((a: Record<string, boolean>, k: string) => ({ ...a, [k]: true }), {});
  host.ws.send(JSON.stringify({ type: "update_config", config: { enabledCategories: allCats } }));
  await waitFor(host.queue, m => m.type === "state" && m.room.config.enabledCategories[Object.keys(CATEGORIES)[0]] === true);
  host.ws.send(JSON.stringify({ type: "start_round" }));
  const choosing = await waitFor(host.queue, m => m.type === "state" && m.room.phase === "choosing");
  const drawer = players.find(p => p.playerId === choosing.room.round.drawerId)!;
  const [author, other] = players.filter(p => p !== drawer);
  const { wordChoices } = await waitFor(drawer.queue, m => m.type === "private_role" && Array.isArray(m.wordChoices));
  const word: string = wordChoices[0];
  drawer.ws.send(JSON.stringify({ type: "choose_word", word }));
  await waitFor(other.queue, m => m.type === "state" && m.room.phase === "drawing");

  author.ws.send(JSON.stringify({ type: "typing" }));
  const typingState = await waitFor(other.queue, m => m.type === "state" && m.room.round?.typingUntil?.[author.playerId] > Date.now());
  assert.deepEqual(Object.keys(typingState.room.round.typingUntil), [author.playerId]);

  // A ping from the drawer is silently ignored — no error back.
  drawer.ws.send(JSON.stringify({ type: "typing" }));

  // One extra letter is always exactly one edit away from the word.
  author.ws.send(JSON.stringify({ type: "guess", text: `${word}x` }));
  const authorRole = await waitFor(author.queue, m => m.type === "private_role" && m.closeEntryIds?.length === 1);
  const otherState = await waitFor(other.queue, m => m.type === "state" && m.room.round?.chatLog?.some((e: any) => e.text === `${word}x`));
  const entry = otherState.room.round.chatLog.find((e: any) => e.text === `${word}x`);
  assert.deepEqual(authorRole.closeEntryIds, [entry.id]);
  assert.deepEqual(entry, { id: entry.id, type: "chat", playerId: author.playerId, text: `${word}x` });
  assert.deepEqual(otherState.room.round.typingUntil, {}, "sending the guess clears the author's typing mark");

  await waitFor(drawer.queue, m => m.type === "private_role" && Array.isArray(m.closeEntryIds));
  for (const p of [other, drawer]) {
    for (const m of p.queue) {
      if (m.type === "private_role") assert.deepEqual(m.closeEntryIds ?? [], [], "a close mark reached another player");
      if (m.type === "state") assert.ok(!JSON.stringify(m).includes("closeEntryIds"), "a close mark leaked into the public state");
    }
  }
  assert.ok(!drawer.queue.some(m => m.type === "error"), "the drawer's ignored typing ping must not come back as an error");

  // End the turn so its 99s phase timer doesn't keep the test process alive.
  for (const p of [author, other]) p.ws.send(JSON.stringify({ type: "guess", text: word }));
  await waitFor(host.queue, m => m.type === "state" && m.room.phase === "reveal");

  for (const p of players) p.ws.close();
});
