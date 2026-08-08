import { describe, test, expect, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppSession } from "./useAppSession";

// useAppSession only reads the route once via useMatches() at mount, to seed
// initial state on a direct visit/refresh (see routeInitFromMatches) — every
// other test here only cares about gameId/mode seeded from a join link or a
// restored session, so an empty match list (root route) is a stable stand-in
// for a real router without pulling in a full data-router harness.
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useMatches: () => [] };
});

function renderAppSession(validJoinLink: Parameters<typeof useAppSession>[0] = null, restored: Parameters<typeof useAppSession>[1] = null) {
  return renderHook(() => useAppSession(validJoinLink, restored));
}

afterEach(() => {
  localStorage.clear();
});

describe("useAppSession", () => {
  test("starts with no game/mode chosen at the root route", () => {
    const { result } = renderAppSession();
    expect(result.current.gameId).toBeNull();
    expect(result.current.mode).toBeNull();
    expect(result.current.groupFlow).toBe(false);
    expect(result.current.game).toBeNull();
  });

  test("seeds gameId from a room join link", () => {
    const { result } = renderAppSession({ kind: "room", gameId: "impostor", code: "ABCDE" } as never);
    expect(result.current.gameId).toBe("impostor");
    expect(result.current.mode).toBe("multi");
  });

  test("seeds groupFlow from a group join link", () => {
    const { result } = renderAppSession({ kind: "group", code: "ABCDE" } as never);
    expect(result.current.groupFlow).toBe(true);
    expect(result.current.mode).toBe("multi");
  });

  test("seeds gameId/mode from a restored session when no route/link applies", () => {
    const { result } = renderAppSession(null, { gameId: "tateti", mode: "local" });
    expect(result.current.gameId).toBe("tateti");
    expect(result.current.mode).toBe("local");
  });

  test("switchToGroupJoin sets pendingGroupJoinCode, join intent, and groupFlow", () => {
    const { result } = renderAppSession();
    act(() => result.current.switchToGroupJoin("XYZ12"));
    expect(result.current.pendingGroupJoinCode).toBe("XYZ12");
    expect(result.current.groupIntent).toBe("join");
    expect(result.current.groupFlow).toBe(true);
  });

  test("handleRoomGameType sets inRoom and adopts the room's gameType", () => {
    const { result } = renderAppSession();
    act(() => result.current.handleRoomGameType("impostor"));
    expect(result.current.inRoom).toBe(true);
    expect(result.current.gameId).toBe("impostor");
  });

  test("handleRoomGameType with null clears gameId only while in group flow", () => {
    const { result } = renderAppSession({ kind: "group", code: "ABCDE" } as never);
    act(() => result.current.handleRoomGameType("impostor"));
    act(() => result.current.handleRoomGameType(null));
    expect(result.current.inRoom).toBe(false);
    expect(result.current.gameId).toBeNull();
  });

  // Guards the "Maximum update depth exceeded" fix (see design doc invariant
  // #2): handleRoomGameType's identity must stay stable across the very
  // setGameId calls it makes, since MultiplayerGame reuses it as both an
  // effect and its own cleanup.
  test("handleRoomGameType keeps a stable identity across gameId changes", () => {
    const { result, rerender } = renderAppSession();
    const first = result.current.handleRoomGameType;
    act(() => result.current.handleRoomGameType("impostor"));
    rerender();
    const second = result.current.handleRoomGameType;
    expect(second).toBe(first);
  });

  // Same invariant as above, but for the App.tsx wiring rewrite (PR3): the
  // ref-indirection pattern must also survive re-renders triggered by
  // completely unrelated state (e.g. mode changing), not just by
  // handleRoomGameType's own setGameId calls — this is what would actually
  // break if the wiring passed `gameId` directly instead of the ref, or
  // widened the dependency array during the rewrite.
  test("handleRoomGameType keeps a stable identity across re-renders from unrelated state changes", () => {
    const { result, rerender } = renderAppSession();
    const first = result.current.handleRoomGameType;
    act(() => result.current.setMode("local"));
    rerender();
    act(() => result.current.setRoomCode("ABCDE"));
    rerender();
    expect(result.current.handleRoomGameType).toBe(first);
  });

  test("GAME_LIST is exposed and non-empty", () => {
    const { result } = renderAppSession();
    expect(result.current.GAME_LIST.length).toBeGreaterThan(0);
  });
});
