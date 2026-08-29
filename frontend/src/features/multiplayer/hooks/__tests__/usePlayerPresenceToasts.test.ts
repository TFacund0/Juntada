import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { usePlayerPresenceToasts } from "../usePlayerPresenceToasts";

function makePlayer(overrides: Partial<PublicPlayer>): PublicPlayer {
  return {
    id: "p1",
    name: "Ana",
    ready: false,
    online: true,
    hasVoted: false,
    ...overrides,
  };
}

function makeRoom(players: PublicPlayer[]): RoomPublicState {
  return {
    code: "ABCDE",
    name: "Sala",
    hostId: "p1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players,
    maxPlayers: 8,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

describe("usePlayerPresenceToasts", () => {
  test("emits reconnect toast when a player flips from offline to online", () => {
    const setStatusToast = vi.fn();
    const player = makePlayer({ id: "p2", name: "Beto", online: false });
    const { rerender } = renderHook(({ room }) => usePlayerPresenceToasts({ room, myPlayerId: "p1", setStatusToast }), {
      initialProps: { room: makeRoom([makePlayer({ id: "p1" }), player]) },
    });
    expect(setStatusToast).not.toHaveBeenCalled();

    rerender({ room: makeRoom([makePlayer({ id: "p1" }), { ...player, online: true }]) });
    expect(setStatusToast).toHaveBeenCalledWith("Beto se reconectó");
  });

  test("emits disconnect toast when a player flips from online to offline", () => {
    const setStatusToast = vi.fn();
    const player = makePlayer({ id: "p2", name: "Beto", online: true });
    const { rerender } = renderHook(({ room }) => usePlayerPresenceToasts({ room, myPlayerId: "p1", setStatusToast }), {
      initialProps: { room: makeRoom([makePlayer({ id: "p1" }), player]) },
    });

    rerender({ room: makeRoom([makePlayer({ id: "p1" }), { ...player, online: false }]) });
    expect(setStatusToast).toHaveBeenCalledWith("Beto se desconectó");
  });

  test("does not emit a toast for the current player's own flip", () => {
    const setStatusToast = vi.fn();
    const me = makePlayer({ id: "p1", name: "Ana", online: true });
    const { rerender } = renderHook(({ room }) => usePlayerPresenceToasts({ room, myPlayerId: "p1", setStatusToast }), {
      initialProps: { room: makeRoom([me]) },
    });

    rerender({ room: makeRoom([{ ...me, online: false }]) });
    expect(setStatusToast).not.toHaveBeenCalled();
  });

  test("does not emit a toast on first observation of a player", () => {
    const setStatusToast = vi.fn();
    renderHook(() =>
      usePlayerPresenceToasts({
        room: makeRoom([makePlayer({ id: "p1" }), makePlayer({ id: "p2", name: "Beto", online: false })]),
        myPlayerId: "p1",
        setStatusToast,
      }),
    );
    expect(setStatusToast).not.toHaveBeenCalled();
  });
});
