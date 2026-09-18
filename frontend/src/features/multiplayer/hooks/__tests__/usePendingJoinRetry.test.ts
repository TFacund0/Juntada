import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { GroupPublicState } from "@juntada/shared-types";
import { usePendingJoinRetry } from "../usePendingJoinRetry";

function makeGroup(overrides: Partial<GroupPublicState> = {}): GroupPublicState {
  return {
    code: "GRPCD",
    name: "Grupo",
    hostId: "p1",
    members: [],
    instances: [{ roomCode: "ROOM1", gameType: "impostor", phase: "lobby" }],
    chat: [],
    ...overrides,
  } as GroupPublicState;
}

describe("usePendingJoinRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("joinInstance sets pendingJoinCode and sends join_instance", () => {
    const send = vi.fn();
    const setError = vi.fn();
    const runTransition = vi.fn((action: () => void) => action());
    const { result } = renderHook(() =>
      usePendingJoinRetry({
        connectionPhase: "group",
        justReconnected: false,
        group: makeGroup(),
        send,
        setError,
        runTransition,
      }),
    );

    result.current.joinInstance("ROOM1");

    expect(send).toHaveBeenCalledWith({ type: "join_instance", roomCode: "ROOM1" });
  });

  test("safety timeout clears pendingJoinCode and surfaces an error after 8s with no response", () => {
    const send = vi.fn();
    const setError = vi.fn();
    const runTransition = vi.fn((action: () => void) => action());
    const { result } = renderHook(
      ({ connectionPhase }) =>
        usePendingJoinRetry({
          connectionPhase,
          justReconnected: false,
          group: makeGroup(),
          send,
          setError,
          runTransition,
        }),
      { initialProps: { connectionPhase: "group" } },
    );

    result.current.joinInstance("ROOM1");
    vi.advanceTimersByTime(8000);

    expect(setError).toHaveBeenCalledWith("No se pudo unir a la partida — probá de nuevo");
  });

  test("pendingJoinCode clears once connectionPhase leaves group", () => {
    const send = vi.fn();
    const setError = vi.fn();
    const runTransition = vi.fn((action: () => void) => action());
    const { result, rerender } = renderHook(
      ({ connectionPhase }) =>
        usePendingJoinRetry({
          connectionPhase,
          justReconnected: false,
          group: makeGroup(),
          send,
          setError,
          runTransition,
        }),
      { initialProps: { connectionPhase: "group" } },
    );

    result.current.joinInstance("ROOM1");
    rerender({ connectionPhase: "lobby" });

    expect(result.current.pendingJoinCode).toBeNull();
  });

  test("resends join_instance on reconnect while still pending in group", () => {
    const send = vi.fn();
    const setError = vi.fn();
    const runTransition = vi.fn((action: () => void) => action());
    const { result, rerender } = renderHook(
      ({ justReconnected }) =>
        usePendingJoinRetry({
          connectionPhase: "group",
          justReconnected,
          group: makeGroup(),
          send,
          setError,
          runTransition,
        }),
      { initialProps: { justReconnected: false } },
    );

    result.current.joinInstance("ROOM1");
    send.mockClear();
    rerender({ justReconnected: true });

    expect(send).toHaveBeenCalledWith({ type: "join_instance", roomCode: "ROOM1" });
  });
});
