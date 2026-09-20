import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { useRoomEventToasts } from "../useRoomEventToasts";

function makePlayer(overrides: Partial<PublicPlayer>): PublicPlayer {
  return {
    id: "p1",
    accountId: "p1",
    name: "Ana",
    ready: false,
    online: true,
    hasVoted: false,
    ...overrides,
  };
}

function makeRoom(overrides: Partial<RoomPublicState>): RoomPublicState {
  return {
    code: "ABCDE",
    name: "Sala",
    hostId: "p1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players: [makePlayer({ id: "p1" })],
    maxPlayers: 8,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
    ...overrides,
  };
}

describe("useRoomEventToasts", () => {
  test("emits 'Volvieron al lobby' and switches lobbyTab when phase returns to lobby", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, setStatusToast, setLobbyTab }), {
      initialProps: { room: makeRoom({ phase: "round" }) },
    });
    expect(setStatusToast).not.toHaveBeenCalled();

    rerender({ room: makeRoom({ phase: "lobby" }) });
    expect(setStatusToast).toHaveBeenCalledWith("Volvieron al lobby");
    expect(setLobbyTab).toHaveBeenCalledWith("players");
  });

  test("emits 'volvió al grupo' toast when a member leaves a group instance", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const beto = makePlayer({ id: "p2", accountId: "p2", name: "Beto" });
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, setStatusToast, setLobbyTab }), {
      initialProps: {
        room: makeRoom({ groupCode: "GRP01", players: [makePlayer({ id: "p1" }), beto] }),
      },
    });

    rerender({ room: makeRoom({ groupCode: "GRP01", players: [makePlayer({ id: "p1" })] }) });
    expect(setStatusToast).toHaveBeenCalledWith("Beto volvió al grupo");
  });

  test("resets snapshot when room becomes null, so no cross-room comparison happens", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, setStatusToast, setLobbyTab }), {
      initialProps: { room: makeRoom({ phase: "round" }) as RoomPublicState | null },
    });

    rerender({ room: null });
    rerender({ room: makeRoom({ phase: "lobby" }) });
    expect(setStatusToast).not.toHaveBeenCalled();
  });

  test("skips comparison across a different room code", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, setStatusToast, setLobbyTab }), {
      initialProps: { room: makeRoom({ code: "AAAAA", phase: "round" }) },
    });

    rerender({ room: makeRoom({ code: "BBBBB", phase: "lobby" }) });
    expect(setStatusToast).not.toHaveBeenCalled();
  });

  test("emits host change toast when hostId changes to another player", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const beto = makePlayer({ id: "p2", accountId: "p2", name: "Beto" });
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, myPlayerId: "p1", setStatusToast, setLobbyTab }), {
      initialProps: {
        room: makeRoom({ hostId: "p1", players: [makePlayer({ id: "p1", accountId: "p1", name: "Ana" }), beto] }),
      },
    });
    expect(setStatusToast).not.toHaveBeenCalled();

    rerender({
      room: makeRoom({ hostId: "p2", players: [makePlayer({ id: "p1", accountId: "p1", name: "Ana" }), beto] }),
    });
    expect(setStatusToast).toHaveBeenCalledWith("Beto es el nuevo anfitrión");
  });

  test("emits personalized toast when current player becomes host", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const beto = makePlayer({ id: "p2", accountId: "p2", name: "Beto" });
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, myPlayerId: "p2", setStatusToast, setLobbyTab }), {
      initialProps: {
        room: makeRoom({ hostId: "p1", players: [makePlayer({ id: "p1", accountId: "p1", name: "Ana" }), beto] }),
      },
    });

    rerender({
      room: makeRoom({ hostId: "p2", players: [makePlayer({ id: "p1", accountId: "p1", name: "Ana" }), beto] }),
    });
    expect(setStatusToast).toHaveBeenCalledWith("Ahora sos el anfitrión");
  });

  test("emits fallback toast when hostId changes but player name cannot be found", () => {
    const setStatusToast = vi.fn();
    const setLobbyTab = vi.fn();
    const { rerender } = renderHook(({ room }) => useRoomEventToasts({ room, myPlayerId: "p1", setStatusToast, setLobbyTab }), {
      initialProps: {
        room: makeRoom({ hostId: "p1", players: [makePlayer({ id: "p1", accountId: "p1", name: "Ana" })] }),
      },
    });

    rerender({
      room: makeRoom({ hostId: "unknown-id", players: [makePlayer({ id: "p1", accountId: "p1", name: "Ana" })] }),
    });
    expect(setStatusToast).toHaveBeenCalledWith("Cambió el anfitrión");
  });
});
