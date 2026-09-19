import { describe, test, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppShell } from "../useAppShell";

// Covers confirmGoBack's leave_room wiring (see useGameBridgeRefs' leaveRoomRef
// doc) — the memo-stability test alongside this one only checks referential
// identity, not behavior.

function makeSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    mode: "multi",
    setMode: vi.fn(),
    setRoomCode: vi.fn(),
    groupFlow: false,
    setGroupFlow: vi.fn(),
    setGroupCode: vi.fn(),
    game: null,
    inRoom: true,
    ...overrides,
  } as unknown as Parameters<typeof useAppShell>[0];
}

function makeDialogs() {
  return { setShowBackConfirm: vi.fn(), setShowExitConfirm: vi.fn() } as unknown as Parameters<typeof useAppShell>[1];
}

function makeHeaderUI() {
  return { setShowRules: vi.fn() } as unknown as Parameters<typeof useAppShell>[2];
}

describe("useAppShell confirmGoBack", () => {
  test("sends leave_room via leaveRoomRef before clearing the multiplayer session, when mode is multi", () => {
    const leaveRoomRef = { current: vi.fn() };
    const withCurtain = (action: () => void) => action();
    const { result } = renderHook(() =>
      useAppShell(makeSession({ mode: "multi" }), makeDialogs(), makeHeaderUI(), withCurtain, leaveRoomRef),
    );

    act(() => result.current.confirmGoBack());

    expect(leaveRoomRef.current).toHaveBeenCalledTimes(1);
  });

  test("never calls leaveRoomRef when mode is local (nothing to tell the server)", () => {
    const leaveRoomRef = { current: vi.fn() };
    const withCurtain = (action: () => void) => action();
    const { result } = renderHook(() =>
      useAppShell(makeSession({ mode: "local" }), makeDialogs(), makeHeaderUI(), withCurtain, leaveRoomRef),
    );

    act(() => result.current.confirmGoBack());

    expect(leaveRoomRef.current).not.toHaveBeenCalled();
  });
});
