import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MockWebSocket } from "../../../test/mockWebSocket";
import { useMultiplayerSocket, clearMultiplayerSession } from "../hooks/useMultiplayerSocket";

// The most critical, most shared piece of the frontend (per the codebase's
// own README/plan notes) — every multiplayer game routes its WS traffic
// through this one hook, so a regression here breaks every game at once.

function lastSocket(): MockWebSocket {
  const ws = MockWebSocket.instances[MockWebSocket.instances.length - 1];
  if (!ws) throw new Error("no MockWebSocket instance was created");
  return ws;
}

beforeEach(() => {
  vi.stubGlobal("WebSocket", MockWebSocket);
  MockWebSocket.reset();
  localStorage.clear();
  clearMultiplayerSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("connect", () => {
  test("opens a socket and calls the explicit onOpen callback instead of auto-rejoining", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    const onOpen = vi.fn();

    act(() => result.current.connect(onOpen));
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    expect(onOpen).toHaveBeenCalledWith(ws);
    expect(ws.sent).toEqual([]); // no rejoin sent when an explicit onOpen is given
  });

  test("reuses the existing socket instead of opening a second one while already connected", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    act(() => lastSocket().simulateOpen());

    act(() => result.current.connect());
    expect(MockWebSocket.instances.length).toBe(1);
  });
});

describe("inbound messages", () => {
  test("'joined' updates me/room/connectionPhase and persists the session", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    expect(result.current.me).toEqual({ playerId: "p1", roomCode: "ABCDE" });
    expect(result.current.connectionPhase).toBe("lobby");
    expect(result.current.room?.code).toBe("ABCDE");
    expect(JSON.parse(localStorage.getItem("impostorgame:session")!)).toEqual({ room: { playerId: "p1", roomCode: "ABCDE" } });
  });

  test("'state' updates room and mirrors room.phase into connectionPhase", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() => ws.simulateMessage({ type: "state", room: { code: "ABCDE", phase: "round", players: [] } }));

    expect(result.current.connectionPhase).toBe("round");
    expect(result.current.room?.phase).toBe("round");
  });

  test("'private_role' sets myRole and clears any pending wordReveal", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() => ws.simulateMessage({ type: "word_reveal", word: "gato" }));
    expect(result.current.wordReveal).not.toBeNull();

    act(() => ws.simulateMessage({ type: "private_role", isImpostor: true }));
    expect(result.current.myRole).toEqual({ type: "private_role", isImpostor: true });
    expect(result.current.wordReveal).toBeNull();
  });

  test("'error' before ever landing in a room drops any stale session and keeps a menu/create/join phase as-is", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.setConnectionPhase("join"));
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() => ws.simulateMessage({ type: "error", code: "JOIN_ROOM_FAILED", message: "No existe ninguna sala con ese código" }));

    expect(result.current.error).toBe("No existe ninguna sala con ese código");
    expect(result.current.me).toBeNull();
    expect(result.current.connectionPhase).toBe("join"); // unchanged — it was already a menu-family phase
  });

  test("'error' while restoring a since-expired session (still on 'menu') doesn't force navigation", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() => ws.simulateMessage({ type: "error", code: "REJOIN_FAILED", message: "La sala ya no existe" }));

    expect(result.current.connectionPhase).toBe("menu");
    expect(result.current.me).toBeNull();
  });

  test("'error' while already in a room keeps the room intact (e.g. a rejected in-round action)", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "round", players: [] },
      }),
    );

    act(() => ws.simulateMessage({ type: "error", code: "INVALID_ACTION", message: "Esa acción no es válida ahora" }));

    expect(result.current.error).toBe("Esa acción no es válida ahora");
    expect(result.current.me).toEqual({ playerId: "p1", roomCode: "ABCDE" });
    expect(result.current.room).not.toBeNull();
  });

  test("'kicked' resets everything back to the menu with an explanatory error", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    act(() => ws.simulateMessage({ type: "kicked" }));

    expect(result.current.connectionPhase).toBe("menu");
    expect(result.current.me).toBeNull();
    expect(result.current.room).toBeNull();
    expect(result.current.error).toBe("Fuiste expulsado de la sala");
  });
});

describe("group messages", () => {
  test("'group_joined' with no active instance updates groupMe/group/connectionPhase and persists the session", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() =>
      ws.simulateMessage({
        type: "group_joined",
        playerId: "p1",
        groupCode: "GRUPO",
        group: { code: "GRUPO", name: "Los pibes", hostId: "p1", members: [], maxMembers: 16, instances: [] },
      }),
    );

    expect(result.current.groupMe).toEqual({ playerId: "p1", groupCode: "GRUPO" });
    expect(result.current.connectionPhase).toBe("group");
    expect(result.current.group?.code).toBe("GRUPO");
    expect(JSON.parse(localStorage.getItem("impostorgame:session")!)).toEqual({ group: { playerId: "p1", groupCode: "GRUPO" } });
  });

  test("'group_joined' followed by 'joined' (rejoin with a live instance) ends up attached to the instance, not the bare group screen", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() =>
      ws.simulateMessage({
        type: "group_joined",
        playerId: "p1",
        groupCode: "GRUPO",
        group: { code: "GRUPO", name: "Los pibes", hostId: "p1", members: [], maxMembers: 16, instances: [] },
      }),
    );
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", groupCode: "GRUPO", players: [] },
      }),
    );

    expect(result.current.connectionPhase).toBe("lobby");
    expect(result.current.room?.code).toBe("ABCDE");
  });

  test("'left_instance' drops the room but keeps the group, landing back on the group screen", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() =>
      ws.simulateMessage({
        type: "group_joined",
        playerId: "p1",
        groupCode: "GRUPO",
        group: { code: "GRUPO", name: "Los pibes", hostId: "p1", members: [], maxMembers: 16, instances: [] },
      }),
    );
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", groupCode: "GRUPO", players: [] },
      }),
    );

    act(() => ws.simulateMessage({ type: "left_instance" }));

    expect(result.current.connectionPhase).toBe("group");
    expect(result.current.room).toBeNull();
    expect(result.current.groupMe).toEqual({ playerId: "p1", groupCode: "GRUPO" });
  });
});

describe("send", () => {
  test("serializes and sends over an open socket", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());

    act(() => result.current.send({ type: "player_ready" }));
    expect(ws.sent).toEqual([JSON.stringify({ type: "player_ready" })]);
  });

  test("sets an error instead of throwing when there's no open socket", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.send({ type: "player_ready" }));
    expect(result.current.error).toBe("Sin conexión con el servidor");
  });
});

describe("reconnection", () => {
  test("a dropped socket flips reconnecting on and retries after 3s, only if a session is persisted", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    act(() => ws.simulateClose());
    expect(result.current.reconnecting).toBe(true);
    expect(result.current.reconnectAttempt).toBe(1);
    expect(MockWebSocket.instances.length).toBe(1);

    act(() => vi.advanceTimersByTime(3000));
    expect(MockWebSocket.instances.length).toBe(2);
  });

  test("a successful reconnect resets the attempt count and briefly flags justReconnected, which clears itself after 3s", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    act(() => lastSocket().simulateOpen());
    act(() =>
      lastSocket().simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );
    // The very first connect of a session shouldn't flash "reconectado" —
    // there was nothing to recover from.
    expect(result.current.justReconnected).toBe(false);

    act(() => lastSocket().simulateClose());
    act(() => vi.advanceTimersByTime(3000));
    act(() => lastSocket().simulateOpen());
    act(() => lastSocket().simulateMessage({ type: "state", room: { code: "ABCDE", phase: "lobby", players: [] } }));

    expect(result.current.reconnecting).toBe(false);
    expect(result.current.reconnectAttempt).toBe(0);
    expect(result.current.justReconnected).toBe(true);

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.justReconnected).toBe(false);
  });

  test("retries back off from 3s up to an 8s cap on repeated drops", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    act(() => lastSocket().simulateOpen());
    act(() =>
      lastSocket().simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    // 1st retry: 3000ms
    act(() => lastSocket().simulateClose());
    expect(result.current.reconnectAttempt).toBe(1);
    act(() => vi.advanceTimersByTime(2999));
    expect(MockWebSocket.instances.length).toBe(1);
    act(() => vi.advanceTimersByTime(1));
    expect(MockWebSocket.instances.length).toBe(2);

    // 2nd retry: 3600ms
    act(() => lastSocket().simulateClose());
    expect(result.current.reconnectAttempt).toBe(2);
    act(() => vi.advanceTimersByTime(3599));
    expect(MockWebSocket.instances.length).toBe(2);
    act(() => vi.advanceTimersByTime(1));
    expect(MockWebSocket.instances.length).toBe(3);
  });

  test("gives up after the max attempts, stops retrying, and exposes reconnectFailed instead of reconnecting forever", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    act(() => lastSocket().simulateOpen());
    act(() =>
      lastSocket().simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    // Each close schedules the next retry (attempts 1..maxReconnectAttempts
    // all still retry) — one more close past the limit (attempt 11) is what
    // finally gives up, so this needs maxReconnectAttempts + 1 drops total.
    // None of the retried sockets are ever opened, simulating a connection
    // that keeps failing outright rather than dropping after succeeding.
    for (let i = 1; i <= result.current.maxReconnectAttempts + 1; i++) {
      act(() => lastSocket().simulateClose());
      act(() => vi.advanceTimersByTime(8000));
    }

    expect(result.current.reconnectFailed).toBe(true);
    expect(result.current.reconnecting).toBe(false);
    const instancesAtGiveUp = MockWebSocket.instances.length;
    act(() => vi.advanceTimersByTime(20000));
    expect(MockWebSocket.instances.length).toBe(instancesAtGiveUp); // no further auto-retry
  });

  test("retryConnection resets reconnectFailed/attempt and opens a fresh socket", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    act(() => lastSocket().simulateOpen());
    act(() =>
      lastSocket().simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    for (let i = 0; i < result.current.maxReconnectAttempts + 1; i++) {
      act(() => lastSocket().simulateClose());
      act(() => vi.advanceTimersByTime(8000));
    }
    expect(result.current.reconnectFailed).toBe(true);

    act(() => result.current.retryConnection());

    expect(result.current.reconnectFailed).toBe(false);
    expect(result.current.reconnectAttempt).toBe(0);
    expect(MockWebSocket.instances.length).toBeGreaterThan(0);
    expect(lastSocket().readyState).not.toBe(MockWebSocket.CLOSED);
  });
});

describe("leave", () => {
  test("closes the socket and resets state to the menu", () => {
    const { result } = renderHook(() => useMultiplayerSocket());
    act(() => result.current.connect());
    const ws = lastSocket();
    act(() => ws.simulateOpen());
    act(() =>
      ws.simulateMessage({
        type: "joined",
        playerId: "p1",
        roomCode: "ABCDE",
        room: { code: "ABCDE", phase: "lobby", players: [] },
      }),
    );

    act(() => result.current.leave());

    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    expect(result.current.connectionPhase).toBe("menu");
    expect(result.current.me).toBeNull();
    expect(result.current.room).toBeNull();
  });
});
