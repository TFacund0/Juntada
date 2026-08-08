import { describe, test, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useGameBridgeRefs } from "../useGameBridgeRefs";

describe("useGameBridgeRefs", () => {
  test("returnToGroupRef defaults to a no-op and updates via exposeReturnToGroup", () => {
    const { result } = renderHook(() => useGameBridgeRefs());
    expect(() => result.current.returnToGroupRef.current()).not.toThrow();

    const fn = () => {};
    act(() => result.current.exposeReturnToGroup(fn));
    expect(result.current.returnToGroupRef.current).toBe(fn);
  });

  test("localGameMidMatchRef defaults to false and updates via exposeLocalGameBack", () => {
    const { result } = renderHook(() => useGameBridgeRefs());
    expect(result.current.localGameMidMatchRef.current()).toBe(false);

    const fn = () => true;
    act(() => result.current.exposeLocalGameBack(fn));
    expect(result.current.localGameMidMatchRef.current).toBe(fn);
    expect(result.current.localGameMidMatchRef.current()).toBe(true);
  });

  test("localGameResetRef defaults to a no-op and updates via exposeLocalGameReset", () => {
    const { result } = renderHook(() => useGameBridgeRefs());
    expect(() => result.current.localGameResetRef.current()).not.toThrow();

    const fn = () => {};
    act(() => result.current.exposeLocalGameReset(fn));
    expect(result.current.localGameResetRef.current).toBe(fn);
  });

  test("expose* callbacks keep a stable identity across rerenders", () => {
    const { result, rerender } = renderHook(() => useGameBridgeRefs());
    const before = {
      exposeReturnToGroup: result.current.exposeReturnToGroup,
      exposeLocalGameBack: result.current.exposeLocalGameBack,
      exposeLocalGameReset: result.current.exposeLocalGameReset,
    };
    rerender();
    expect(result.current.exposeReturnToGroup).toBe(before.exposeReturnToGroup);
    expect(result.current.exposeLocalGameBack).toBe(before.exposeLocalGameBack);
    expect(result.current.exposeLocalGameReset).toBe(before.exposeLocalGameReset);
  });
});
