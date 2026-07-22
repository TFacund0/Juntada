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
const { createApp } = require("../src/app");
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
  const { rooms, groups, clients } = require("../src/state/roomStore");
  rooms.clear();
  groups.clear();
  clients.clear();
});

function openSocketWithQueue(): Promise<{ ws: WSClient; queue: any[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
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

async function createRoom(playerName: string): Promise<Connected & { roomCode: string }> {
  const { ws, queue } = await openSocketWithQueue();
  ws.send(JSON.stringify({ type: "create_room", playerName, gameType: "rayado-libre" }));
  const joined = await waitFor(queue, m => m.type === "joined");
  return { ws, queue, playerId: joined.playerId, roomCode: joined.roomCode };
}

async function joinRoom(playerName: string, code: string): Promise<Connected> {
  const { ws, queue } = await openSocketWithQueue();
  ws.send(JSON.stringify({ type: "join_room", playerName, code }));
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
  const secondChoosingState = await waitFor(host.queue, m => m.type === "state" && m.room.phase === "choosing" && m.room.round.drawerId !== firstDrawerId);
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
