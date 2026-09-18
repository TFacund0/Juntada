import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMemberActions } from "../useMemberActions";

describe("useMemberActions", () => {
  test("transferHost sends a transfer_host payload and closes the menu", () => {
    const send = vi.fn();
    const closePlayerMenu = vi.fn();
    const { result } = renderHook(() => useMemberActions({ send, closePlayerMenu }));

    result.current.transferHost("player-2");

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ type: "transfer_host", targetId: "player-2" });
    expect(closePlayerMenu).toHaveBeenCalledTimes(1);
  });

  test("kickMember and kickPlayer use distinct message types", () => {
    const send = vi.fn();
    const closePlayerMenu = vi.fn();
    const { result } = renderHook(() => useMemberActions({ send, closePlayerMenu }));

    result.current.kickMember("p1");
    result.current.kickPlayer("p2");

    expect(send).toHaveBeenNthCalledWith(1, { type: "kick_member", targetId: "p1" });
    expect(send).toHaveBeenNthCalledWith(2, { type: "kick_player", targetId: "p2" });
  });

  test("callbacks stay referentially stable across re-renders with the same deps", () => {
    const send = vi.fn();
    const closePlayerMenu = vi.fn();
    const { result, rerender } = renderHook(() => useMemberActions({ send, closePlayerMenu }));

    const first = result.current;
    rerender();
    const second = result.current;

    expect(second.transferHost).toBe(first.transferHost);
    expect(second.kickMember).toBe(first.kickMember);
    expect(second.kickPlayer).toBe(first.kickPlayer);
  });
});
