import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useMultiplayerSession } from "../useMultiplayerSession";
import { SESSION_KEY } from "../../services/multiplayerSession";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("seeding", () => {
  test("seeds me/groupMe from a persisted session on mount", () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" }, group: { playerId: "p1", groupCode: "GRUPO" } }),
    );

    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.me).toEqual({ playerId: "p1", roomCode: "ABCDE" });
    expect(result.current.groupMe).toEqual({ playerId: "p1", groupCode: "GRUPO" });
  });

  test("seeds null me/groupMe when nothing is persisted", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.me).toBeNull();
    expect(result.current.groupMe).toBeNull();
  });
});

describe("persistence effects", () => {
  test("setMe persists the current groupMe alongside the new room session", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));

    act(() => result.current.setGroupMe({ playerId: "p1", groupCode: "GRUPO" }));
    act(() => result.current.setMe({ playerId: "p1", roomCode: "ABCDE" }));

    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual({
      room: { playerId: "p1", roomCode: "ABCDE" },
      group: { playerId: "p1", groupCode: "GRUPO" },
    });
  });

  test("setGroupMe persists the current me alongside the new group session", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));

    act(() => result.current.setMe({ playerId: "p1", roomCode: "ABCDE" }));
    act(() => result.current.setGroupMe({ playerId: "p1", groupCode: "GRUPO" }));

    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual({
      room: { playerId: "p1", roomCode: "ABCDE" },
      group: { playerId: "p1", groupCode: "GRUPO" },
    });
  });

  test("setting both to null clears the persisted session entirely", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" } }));
    const { result } = renderHook(() => useMultiplayerSession({}));

    act(() => result.current.setMe(null));

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

describe("entryKind gating", () => {
  test("entryKind 'room' disables group-driven hasActiveSession", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ group: { playerId: "p1", groupCode: "GRUPO" } }));
    const { result } = renderHook(() => useMultiplayerSession({ entryKind: "room" }));

    expect(result.current.groupSessionEnabled).toBe(false);
    expect(result.current.roomSessionEnabled).toBe(true);
    expect(result.current.hasActiveSession).toBe(false);
    expect(result.current.readHasActiveSession()).toBe(false);
  });

  test("entryKind 'group' disables room-driven hasActiveSession", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" } }));
    const { result } = renderHook(() => useMultiplayerSession({ entryKind: "group" }));

    expect(result.current.groupSessionEnabled).toBe(true);
    expect(result.current.roomSessionEnabled).toBe(false);
    expect(result.current.hasActiveSession).toBe(false);
    expect(result.current.readHasActiveSession()).toBe(false);
  });

  test("no entryKind enables both room and group sessions", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ group: { playerId: "p1", groupCode: "GRUPO" } }));
    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.hasActiveSession).toBe(true);
    expect(result.current.readHasActiveSession()).toBe(true);
  });
});

describe("hasActiveSession / readHasActiveSession parity", () => {
  test("both flip to true together once a session is set, and stay in sync across updates", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.hasActiveSession).toBe(false);
    expect(result.current.readHasActiveSession()).toBe(false);

    act(() => result.current.setMe({ playerId: "p1", roomCode: "ABCDE" }));

    expect(result.current.hasActiveSession).toBe(true);
    expect(result.current.readHasActiveSession()).toBe(true);

    act(() => result.current.setMe(null));

    expect(result.current.hasActiveSession).toBe(false);
    expect(result.current.readHasActiveSession()).toBe(false);
  });
});

describe("getRejoinMessage", () => {
  test("prefers rejoin_group when a group session is enabled and present", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));
    act(() => result.current.setGroupMe({ playerId: "p1", groupCode: "GRUPO" }));

    expect(result.current.getRejoinMessage()).toEqual({ type: "rejoin_group", groupCode: "GRUPO" });
  });

  test("falls back to rejoin when only a room session is present", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));
    act(() => result.current.setMe({ playerId: "p1", roomCode: "ABCDE" }));

    expect(result.current.getRejoinMessage()).toEqual({ type: "rejoin", roomCode: "ABCDE" });
  });

  test("returns null when neither session is present", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.getRejoinMessage()).toBeNull();
  });

  test("ignores a group session disabled by entryKind 'room', falling back to rejoin", () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" }, group: { playerId: "p1", groupCode: "GRUPO" } }),
    );
    const { result } = renderHook(() => useMultiplayerSession({ entryKind: "room" }));

    expect(result.current.getRejoinMessage()).toEqual({ type: "rejoin", roomCode: "ABCDE" });
  });
});

describe("initialColdStart", () => {
  test("true when a persisted room session exists and roomSessionEnabled", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ room: { playerId: "p1", roomCode: "ABCDE" } }));
    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.initialColdStart).toBe(true);
  });

  test("false for a persisted group session ignored via entryKind 'room'", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ group: { playerId: "p1", groupCode: "GRUPO" } }));
    const { result } = renderHook(() => useMultiplayerSession({ entryKind: "room" }));

    expect(result.current.initialColdStart).toBe(false);
  });

  test("false when nothing is persisted", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));

    expect(result.current.initialColdStart).toBe(false);
  });

  test("stays fixed to the mount snapshot even after me changes later", () => {
    const { result } = renderHook(() => useMultiplayerSession({}));
    expect(result.current.initialColdStart).toBe(false);

    act(() => result.current.setMe({ playerId: "p1", roomCode: "ABCDE" }));

    expect(result.current.initialColdStart).toBe(false);
  });
});
