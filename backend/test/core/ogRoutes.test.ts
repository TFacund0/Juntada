import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "http";
import type { Room, Group } from "@juntada/shared-types";

const { createApp } = require("../../src/app") as { createApp: () => Server };
const { rooms, groups, clients } = require("../../src/state/roomStore") as {
  rooms: Map<string, Room>;
  groups: Map<string, Group>;
  clients: Map<unknown, unknown>;
};

let server: Server;
let baseUrl: string;

before(async () => {
  server = createApp();
  await new Promise<void>(resolve => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

beforeEach(() => {
  rooms.clear();
  groups.clear();
  clients.clear();
});

test("GET / returns index.html with default OpenGraph tags", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<meta property="og:title" content="Juntada" \/>/);
  assert.match(html, /<meta property="og:description" content="Juegos para jugar en grupo" \/>/);
});

test("GET /join/:code injects dynamic tags when matching an active room", async () => {
  const testRoom: Room = {
    code: "TEST1",
    name: "Sala de Prueba",
    hostId: "h1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players: [
      { id: "h1", accountId: "acc-h1", name: "Host", ready: false, online: true },
      { id: "p2", accountId: "acc-p2", name: "Player 2", ready: false, online: true },
    ],
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
  rooms.set("TEST1", testRoom);

  const res = await fetch(`${baseUrl}/join/TEST1`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<title>Juntada · ¡Unite a la partida!<\/title>/);
  assert.match(html, /<meta property="og:title" content="Juntada · ¡Unite a la partida!" \/>/);
  assert.match(html, /<meta property="og:description" content="Sala TEST1 · 2 esperando para jugar" \/>/);
});

test("GET /join/:code injects dynamic tags when matching an active group", async () => {
  const testGroup: Group = {
    code: "GRP99",
    name: "Los Amigos",
    hostId: "h1",
    members: [
      { id: "h1", accountId: "acc-h1", name: "Host", online: true },
      { id: "m2", accountId: "acc-m2", name: "M2", online: true },
      { id: "m3", accountId: "acc-m3", name: "M3", online: true },
    ],
    chat: [],
  };
  groups.set("GRP99", testGroup);

  const res = await fetch(`${baseUrl}/join/GRP99`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<title>Juntada · ¡Unite a Los Amigos!<\/title>/);
  assert.match(html, /<meta property="og:title" content="Juntada · ¡Unite a Los Amigos!" \/>/);
  assert.match(html, /<meta property="og:description" content="Grupo GRP99 · 3 miembros" \/>/);
});

test("GET /room/:gameId/:code injects dynamic tags for active room", async () => {
  const testRoom: Room = {
    code: "RM001",
    name: "Sala de Prueba",
    hostId: "h1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players: [
      { id: "h1", accountId: "acc-h1", name: "Host", ready: false, online: true },
      { id: "p2", accountId: "acc-p2", name: "Player 2", ready: false, online: true },
    ],
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
  rooms.set("RM001", testRoom);

  const res = await fetch(`${baseUrl}/room/impostor/RM001`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<title>Juntada · ¡Unite a la partida!<\/title>/);
  assert.match(html, /<meta property="og:title" content="Juntada · ¡Unite a la partida!" \/>/);
  assert.match(html, /<meta property="og:description" content="Sala RM001 · 2 esperando para jugar" \/>/);
});

test("GET /group/:code injects dynamic tags for active group", async () => {
  const testGroup: Group = {
    code: "GR001",
    name: "La Banda",
    hostId: "h1",
    members: [{ id: "h1", accountId: "acc-h1", name: "Host", online: true }],
    chat: [],
  };
  groups.set("GR001", testGroup);

  const res = await fetch(`${baseUrl}/group/GR001`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<title>Juntada · ¡Unite a La Banda!<\/title>/);
  assert.match(html, /<meta property="og:title" content="Juntada · ¡Unite a La Banda!" \/>/);
  assert.match(html, /<meta property="og:description" content="Grupo GR001 · 1 miembros" \/>/);
});

test("GET /join/:code falls back to default tags when code is unknown", async () => {
  const res = await fetch(`${baseUrl}/join/NOEXI`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /<meta property="og:title" content="Juntada" \/>/);
  assert.match(html, /<meta property="og:description" content="Juegos para jugar en grupo" \/>/);
});
