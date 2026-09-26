import { afterEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useChatFeedback } from "../hooks/useChatFeedback";
import type { RayadoSfx } from "../hooks/useRayadoSfx";
import type { ChatEntry } from "../types/roundView";

function fakeSfx() {
  return { muted: false, toggleMuted: vi.fn(), play: vi.fn(), vibrate: vi.fn(), scribble: {} } as unknown as RayadoSfx & {
    play: ReturnType<typeof vi.fn>;
  };
}

const history: ChatEntry[] = [
  { id: 1, type: "chat", playerId: "p3", text: "viejo" },
  { id: 2, type: "correct", playerId: "p3" },
];

function setup(canAnimate = () => true) {
  const sfx = fakeSfx();
  const hook = renderHook(
    ({ chatLog, closeEntryIds }: { chatLog: ChatEntry[]; closeEntryIds: number[] }) =>
      useChatFeedback({ chatLog, myId: "me", closeEntryIds, sfx, canAnimate }),
    { initialProps: { chatLog: history, closeEntryIds: [] as number[] } },
  );
  return { sfx, ...hook };
}

afterEach(() => vi.useRealTimers());

describe("useChatFeedback", () => {
  test("no sound for the history already there on mount", () => {
    const { sfx } = setup();
    expect(sfx.play).not.toHaveBeenCalled();
  });

  test("someone else's message → msg; someone else's correct guess → otherOk", () => {
    const { sfx, rerender } = setup();
    rerender({ chatLog: [...history, { id: 3, type: "chat", playerId: "p3", text: "perro" }], closeEntryIds: [] });
    expect(sfx.play).toHaveBeenLastCalledWith("msg");
    rerender({
      chatLog: [...history, { id: 3, type: "chat", playerId: "p3", text: "perro" }, { id: 4, type: "correct", playerId: "p4" }],
      closeEntryIds: [],
    });
    expect(sfx.play).toHaveBeenLastCalledWith("otherOk");
  });

  test("my own message → mine, unless it turned out to be close → close, and the input shakes", () => {
    vi.useFakeTimers();
    const { sfx, rerender, result } = setup();
    const mine: ChatEntry = { id: 3, type: "chat", playerId: "me", text: "gat" };
    rerender({ chatLog: [...history, mine], closeEntryIds: [] });
    act(() => vi.advanceTimersByTime(200));
    expect(sfx.play).toHaveBeenLastCalledWith("mine");
    expect(result.current).toBe(0);

    const close: ChatEntry = { id: 4, type: "chat", playerId: "me", text: "perr" };
    rerender({ chatLog: [...history, mine, close], closeEntryIds: [] });
    rerender({ chatLog: [...history, mine, close], closeEntryIds: [4] });
    act(() => vi.advanceTimersByTime(200));
    expect(sfx.play.mock.calls.map(c => c[0])).toEqual(["mine", "close"]);
    expect(result.current).toBe(1);
  });

  test("nothing plays while the tab is hidden or just came back", () => {
    const { sfx, rerender } = setup(() => false);
    rerender({ chatLog: [...history, { id: 3, type: "chat", playerId: "p3", text: "perro" }], closeEntryIds: [] });
    expect(sfx.play).not.toHaveBeenCalled();
  });
});
