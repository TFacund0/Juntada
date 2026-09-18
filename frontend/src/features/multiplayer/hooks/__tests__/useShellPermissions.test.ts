import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import type { RoomPublicState, GroupPublicState, PublicPlayer } from "@juntada/shared-types";
import type { RoomSession } from "../../services/multiplayerSession";
import { useShellPermissions } from "../useShellPermissions";

function makePlayer(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id: "p1", accountId: "p1", name: "Ana", ready: false, online: true, hasVoted: false, ...overrides };
}

function makeRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "ROOM1",
    name: "Sala",
    hostId: "p1",
    gameType: "impostor",
    groupCode: null,
    phase: "lobby",
    players: [makePlayer()],
    maxPlayers: 8,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
    ...overrides,
  } as RoomPublicState;
}

function makeGroup(overrides: Partial<GroupPublicState> = {}): GroupPublicState {
  return {
    code: "GRPCD",
    name: "Grupo",
    hostId: "p1",
    members: [],
    instances: [],
    chat: [],
    ...overrides,
  } as GroupPublicState;
}

function makeMe(overrides: Partial<RoomSession> = {}): RoomSession {
  return { playerId: "p1", roomCode: "ROOM1", ...overrides };
}

describe("useShellPermissions", () => {
  test("isHost is true when me.playerId matches room.hostId", () => {
    const { result } = renderHook(() => useShellPermissions({ me: makeMe(), room: makeRoom(), group: null, gameId: "impostor" }));
    expect(result.current.isHost).toBe(true);
  });

  test("isHost is false when there is no room", () => {
    const { result } = renderHook(() => useShellPermissions({ me: makeMe(), room: null, group: null, gameId: "impostor" }));
    expect(result.current.isHost).toBe(false);
  });

  test("isGroupHost is true when me.playerId matches group.hostId", () => {
    const { result } = renderHook(() => useShellPermissions({ me: makeMe(), room: null, group: makeGroup(), gameId: "impostor" }));
    expect(result.current.isGroupHost).toBe(true);
  });

  test("isGroupHost is false when there is no group", () => {
    const { result } = renderHook(() => useShellPermissions({ me: makeMe(), room: makeRoom(), group: null, gameId: "impostor" }));
    expect(result.current.isGroupHost).toBe(false);
  });

  test("myPlayer finds the player matching me.playerId in room.players", () => {
    const { result } = renderHook(() =>
      useShellPermissions({
        me: makeMe({ playerId: "p2" }),
        room: makeRoom({ players: [makePlayer({ id: "p1" }), makePlayer({ id: "p2", accountId: "p2", name: "Beto" })] }),
        group: null,
        gameId: "impostor",
      }),
    );
    expect(result.current.myPlayer?.name).toBe("Beto");
  });

  test("myPlayer is undefined when there is no room", () => {
    const { result } = renderHook(() => useShellPermissions({ me: makeMe(), room: null, group: null, gameId: "impostor" }));
    expect(result.current.myPlayer).toBeUndefined();
  });

  test("selectedGame resolves from gameId, undefined when gameId is empty", () => {
    const { result: withId } = renderHook(() => useShellPermissions({ me: undefined, room: null, group: null, gameId: "impostor" }));
    expect(withId.current.selectedGame?.id).toBe("impostor");

    const { result: withoutId } = renderHook(() => useShellPermissions({ me: undefined, room: null, group: null, gameId: "" }));
    expect(withoutId.current.selectedGame).toBeUndefined();
  });

  test("activeGame prefers room.gameType, falls back to selectedGame when no room", () => {
    const { result: withRoom } = renderHook(() =>
      useShellPermissions({ me: makeMe(), room: makeRoom({ gameType: "impostor" }), group: null, gameId: "impostor" }),
    );
    expect(withRoom.current.activeGame?.id).toBe("impostor");

    const { result: noRoom } = renderHook(() => useShellPermissions({ me: undefined, room: null, group: null, gameId: "impostor" }));
    expect(noRoom.current.activeGame?.id).toBe("impostor");
  });
});
