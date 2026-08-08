import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MockWebSocket } from "../../../test/mockWebSocket";
import { clearMultiplayerSession } from "../hooks/useMultiplayerSocket";
import { MultiplayerGame } from "../MultiplayerGame";

// The shell every online game routes through (connect/menu/lobby/in-round,
// plus the whole group flow) — previously untested despite being the
// biggest, riskiest file in the frontend to touch blind. Uses the same
// MockWebSocket pattern as useMultiplayerSocket.test.ts, but renders the
// real component tree so these also catch a render-branch regression, not
// just a socket-state one.

function lastSocket(): MockWebSocket {
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!ws) throw new Error("no MockWebSocket instance was created");
  return ws;
}

// tateti is a real registered game whose LocalGame/ConfigPanel/RoundView are
// all React.lazy() (see games/tateti/index.tsx) — using it here means these
// tests also exercise the Suspense fallback path every other game goes
// through, not a fake game that'd hide that behavior.
const GAME_ID = "tateti";

// Every test below eventually needs a full RoomPublicState payload for a
// "joined"/"state" message — only phase/players/round actually vary per
// test, so those are the only overrides worth naming at each call site.
function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    code: "ABCDE",
    name: "Mi sala",
    hostId: "p1",
    gameType: GAME_ID,
    groupCode: null,
    phase: "lobby",
    players: [{ id: "p1", name: "Ana", ready: false, online: true, hasVoted: false }],
    maxPlayers: 4,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
    ...overrides,
  };
}

function joinedMessage(roomOverrides: Record<string, unknown> = {}) {
  return { type: "joined", playerId: "p1", roomCode: "ABCDE", room: makeRoom(roomOverrides) };
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", MockWebSocket);
  MockWebSocket.reset();
  localStorage.clear();
  clearMultiplayerSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MultiplayerGame — menu", () => {
  test("shows create/join toggle and the player's name", () => {
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear partida" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Unirme" })).toBeInTheDocument();
  });
});

describe("MultiplayerGame — menu, creating", () => {
  test("the create button shows a loading state while waiting for the server, then clears once the room arrives", async () => {
    const user = userEvent.setup();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear partida" }));

    expect(screen.getByRole("button", { name: "Creando..." })).toBeDisabled();

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(joinedMessage()));

    expect(screen.queryByRole("button", { name: "Creando..." })).not.toBeInTheDocument();
  });
});

describe("MultiplayerGame — standalone room lobby", () => {
  async function createRoomAsHost() {
    const user = userEvent.setup();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear partida" }));

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(joinedMessage()));
    return { ws };
  }

  test("host sees the room code, the player list, and a start button gated on min players", async () => {
    await createRoomAsHost();
    expect(await screen.findByText("ABCDE")).toBeInTheDocument();
    expect(screen.getByText(/^Ana/, { selector: "span" })).toBeInTheDocument();
    // tateti needs 2 players — only 1 is in the room, so starting is blocked.
    expect(await screen.findByText(/Necesitás mínimo 2 jugadores/)).toBeInTheDocument();
  });

  test("start button enables once the room has enough players", async () => {
    const { ws } = await createRoomAsHost();
    await screen.findByText("ABCDE");

    act(() =>
      ws.simulateMessage({
        type: "state",
        room: makeRoom({
          players: [
            { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
            { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
          ],
        }),
      }),
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "Iniciar ronda" })).not.toBeDisabled());
  });
});

describe("MultiplayerGame — in-round view", () => {
  test("once the room's phase leaves 'lobby', the game's own RoundView renders instead of the lobby", async () => {
    const user = userEvent.setup();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear partida" }));

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage(
        joinedMessage({
          phase: "round",
          players: [
            { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
            { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
          ],
          round: { board: Array(9).fill(null), turnId: "p1", winner: null },
        }),
      ),
    );

    // Lobby-only chrome (the room code card) is gone; tateti's RoundView owns
    // the screen now.
    await waitFor(() => expect(screen.queryByText("ABCDE")).not.toBeInTheDocument());
    expect(screen.queryByText(/Necesitás mínimo/)).not.toBeInTheDocument();
  });
});

describe("MultiplayerGame — group flow", () => {
  test("creating a group shows its code and member list", async () => {
    const user = userEvent.setup();
    render(<MultiplayerGame entryKind="group" gameId={null} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear grupo" }));

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "group_joined",
        playerId: "p1",
        groupCode: "GRP01",
        group: {
          code: "GRP01",
          name: "Los pibes",
          hostId: "p1",
          members: [{ id: "p1", name: "Ana", online: true }],
          maxMembers: 8,
          instances: [],
          chat: [],
        },
      }),
    );

    // GroupScreen renderiza el código dos veces (chip compacto de desktop +
    // card grande de mobile) y CSS decide cuál se ve según el ancho de
    // pantalla — jsdom no evalúa @media, así que ambas están siempre en el
    // DOM en este entorno de test.
    expect((await screen.findAllByText("GRP01")).length).toBeGreaterThan(0);
    expect(screen.getByText("Los pibes")).toBeInTheDocument();
    expect(screen.getByText("Nadie abrió una partida todavía.")).toBeInTheDocument();
  });
});

describe("MultiplayerGame — reconnect banner", () => {
  test("a dropped socket shows a reconnecting banner, then a brief confirmation once it recovers", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear partida" }));

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage(joinedMessage()));
    await screen.findByText("ABCDE");

    act(() => ws.simulateClose());
    expect(await screen.findByText(/Reconectando a la sala/)).toBeInTheDocument();

    // The retry itself is scheduled behind a backoff timeout (see
    // reconnectDelayMs) rather than firing immediately on close.
    await act(() => vi.advanceTimersByTimeAsync(3000));
    const reconnectWs = lastSocket();
    act(() => reconnectWs.simulateOpen());
    // Opening the socket alone only sends the rejoin — justReconnected only
    // flips once a response actually confirms the round trip works (see
    // onReconnected in useMultiplayerSocket).
    act(() => reconnectWs.simulateMessage(joinedMessage()));
    expect(await screen.findByText("Reconectado")).toBeInTheDocument();

    vi.useRealTimers();
  });
});

describe("MultiplayerGame — cold start (persisted session on mount)", () => {
  // Simulates reopening the app (or reloading the page) with a session
  // already saved from a previous visit — the exact scenario behind "a
  // veces se queda colgada la partida y tengo que recargar": the reload
  // itself should show the full-screen "Autenticando" gate and then either
  // offer to rejoin the game in progress, or say plainly that it's gone.
  function seedPersistedRoomSession() {
    localStorage.setItem("impostorgame:session", JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" } }));
  }

  test("shows the authenticating gate, then offers to rejoin a game already in progress", async () => {
    const user = userEvent.setup();
    seedPersistedRoomSession();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);

    // Blocks the whole screen immediately — no menu/lobby flash underneath.
    expect(screen.getByText("Autenticando")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear partida" })).not.toBeInTheDocument();

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ type: "rejoin", roomCode: "ABCDE", playerId: "p1" });

    // The rejoin lands mid-round (not "lobby") — instead of silently
    // dropping the player back into a live game, it asks first.
    act(() => ws.simulateMessage(joinedMessage({ phase: "playing" })));
    expect(await screen.findByText("Ana", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar a la partida/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Entrar a la partida/ }));
    // The gate is gone — the underlying game screen renders now.
    expect(screen.queryByText("Autenticando")).not.toBeInTheDocument();
  });

  test("silently drops a stale persisted session instead of blocking the menu with 'ya no existe'", async () => {
    // This is the silent background auto-rejoin on mount, not a live drop
    // mid-session — the player never asked to reconnect to anything (they
    // may just want to create a brand-new room), so a REJOIN_FAILED here
    // should just forget the stale session and land on the normal menu
    // instead of blocking behind a "la sala ya no existe" screen.
    seedPersistedRoomSession();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() => ws.simulateMessage({ type: "error", code: "REJOIN_FAILED", message: "La sala ya no existe" }));

    expect(await screen.findByRole("button", { name: "Crear partida" })).toBeInTheDocument();
    expect(screen.queryByText(/ya no existe/)).not.toBeInTheDocument();
  });

  test("group-attached cold start doesn't hang on 'Autenticando' forever when the persisted instance already ended", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Persisted session has both a group and a room — the group-attached,
    // active-instance case. onopen only sends rejoin_group for this (never
    // "rejoin"), and the hook waits for a "joined" that would follow if the
    // instance were still live (see the comment in useMultiplayerSocket's
    // group_joined branch). Here it never comes — the instance ended while
    // offline — so only the fallback timeout can unstick the gate.
    localStorage.setItem(
      "impostorgame:session",
      JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" }, group: { playerId: "p1", groupCode: "GRUPO1" } }),
    );
    render(<MultiplayerGame entryKind="group" gameId={GAME_ID} playerName="Ana" />);
    expect(screen.getByText("Autenticando")).toBeInTheDocument();

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ type: "rejoin_group", groupCode: "GRUPO1", playerId: "p1" });

    act(() =>
      ws.simulateMessage({
        type: "group_joined",
        playerId: "p1",
        groupCode: "GRUPO1",
        group: {
          code: "GRUPO1",
          name: "La banda",
          hostId: "p1",
          members: [{ id: "p1", name: "Ana", online: true }],
          maxMembers: 8,
          instances: [],
          chat: [],
        },
      }),
    );
    // Still waiting for the "joined" that isn't coming — the gate stays up
    // rather than flashing the group screen and yanking it back.
    expect(screen.getByText("Autenticando")).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1500));
    expect(screen.queryByText("Autenticando")).not.toBeInTheDocument();
    expect(await screen.findByText("La banda")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
