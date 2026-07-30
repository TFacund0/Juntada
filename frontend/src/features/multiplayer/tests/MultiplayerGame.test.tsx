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
    expect(screen.getByRole("button", { name: "Unirse" })).toBeInTheDocument();
  });
});

describe("MultiplayerGame — menu, creating", () => {
  test("the create button shows a loading state while waiting for the server, then clears once the room arrives", async () => {
    const user = userEvent.setup();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear partida" }));
    await user.click(screen.getAllByRole("button", { name: "Crear partida" }).slice(-1)[0]);

    expect(screen.getByRole("button", { name: "Creando..." })).toBeDisabled();

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: {
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
        },
      }),
    );

    expect(screen.queryByRole("button", { name: "Creando..." })).not.toBeInTheDocument();
  });
});

describe("MultiplayerGame — standalone room lobby", () => {
  async function createRoomAsHost() {
    const user = userEvent.setup();
    render(<MultiplayerGame entryKind="room" gameId={GAME_ID} playerName="Ana" />);
    await user.click(screen.getByRole("button", { name: "Crear partida" }));
    await user.click(screen.getAllByRole("button", { name: "Crear partida" }).slice(-1)[0]);

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: {
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
        },
      }),
    );
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
        room: {
          code: "ABCDE",
          name: "Mi sala",
          hostId: "p1",
          gameType: GAME_ID,
          groupCode: null,
          phase: "lobby",
          players: [
            { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
            { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
          ],
          maxPlayers: 4,
          config: {},
          round: null,
          usedWords: {},
          roundHistory: [],
        },
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
    await user.click(screen.getAllByRole("button", { name: "Crear partida" }).slice(-1)[0]);

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: {
          code: "ABCDE",
          name: "Mi sala",
          hostId: "p1",
          gameType: GAME_ID,
          groupCode: null,
          phase: "round",
          players: [
            { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
            { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
          ],
          maxPlayers: 4,
          config: {},
          round: { board: Array(9).fill(null), turnId: "p1", winner: null },
          usedWords: {},
          roundHistory: [],
        },
      }),
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
    await user.click(screen.getAllByRole("button", { name: "Crear grupo" }).slice(-1)[0]);

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
        },
      }),
    );

    expect(await screen.findByText("GRP01")).toBeInTheDocument();
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
    await user.click(screen.getAllByRole("button", { name: "Crear partida" }).slice(-1)[0]);

    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: {
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
        },
      }),
    );
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
    act(() =>
      reconnectWs.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: {
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
        },
      }),
    );
    expect(await screen.findByText("Reconectado ✓")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
