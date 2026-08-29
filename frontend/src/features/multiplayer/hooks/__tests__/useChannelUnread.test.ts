import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ChatMessage } from "@juntada/shared-types";
import type { ChatChannel } from "../../components/FloatingChat";
import { useChannelUnread } from "../useChannelUnread";

function makeMessages(count: number): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    playerId: "p1",
    playerName: "Jugador",
    text: `msg ${i}`,
    ts: i,
  })) as ChatMessage[];
}

function makeChannel(overrides: Partial<ChatChannel> = {}): ChatChannel {
  return {
    id: "group",
    tabLabel: "Grupo",
    title: "Grupo",
    subtitle: "sub",
    accent: "group",
    messages: [],
    onSend: vi.fn(),
    ...overrides,
  };
}

function setup(overrides: { channels: ChatChannel[]; open: boolean; activeChannelId: string | undefined }) {
  return renderHook(props => useChannelUnread(props), { initialProps: overrides });
}

describe("useChannelUnread", () => {
  test("1. first render seeds lastSeen from current lengths -> all counts 0", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(3) })];
    const { result } = setup({ channels, open: false, activeChannelId: undefined });

    expect(result.current.unreadByChannel["group"]).toBeUndefined();
    expect(result.current.totalUnread).toBe(0);
  });

  test("2. closed panel + a channel gains 2 messages -> that channel reads 2, totalUnread 2", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(1) })];
    const { result, rerender } = setup({ channels, open: false, activeChannelId: undefined });

    rerender({ channels: [makeChannel({ id: "group", messages: makeMessages(3) })], open: false, activeChannelId: undefined });

    expect(result.current.unreadByChannel["group"]).toBe(2);
    expect(result.current.totalUnread).toBe(2);
  });

  test("3. open panel on the active channel -> its count forced to 0 while others keep theirs", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(1) }), makeChannel({ id: "room", messages: makeMessages(1) })];
    const { result, rerender } = setup({ channels, open: false, activeChannelId: "group" });

    rerender({
      channels: [makeChannel({ id: "group", messages: makeMessages(3) }), makeChannel({ id: "room", messages: makeMessages(2) })],
      open: false,
      activeChannelId: "group",
    });
    expect(result.current.unreadByChannel["group"]).toBe(2);
    expect(result.current.unreadByChannel["room"]).toBe(1);

    rerender({
      channels: [makeChannel({ id: "group", messages: makeMessages(3) }), makeChannel({ id: "room", messages: makeMessages(2) })],
      open: true,
      activeChannelId: "group",
    });

    expect(result.current.unreadByChannel["group"]).toBe(0);
    expect(result.current.unreadByChannel["room"]).toBe(1);
  });

  test("4. growth on the non-active channel while open still accumulates", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(1) }), makeChannel({ id: "room", messages: makeMessages(1) })];
    const { result, rerender } = setup({ channels, open: true, activeChannelId: "group" });

    rerender({
      channels: [makeChannel({ id: "group", messages: makeMessages(1) }), makeChannel({ id: "room", messages: makeMessages(4) })],
      open: true,
      activeChannelId: "group",
    });

    expect(result.current.unreadByChannel["room"]).toBe(3);
  });

  test("5. counts accumulate across successive growths rather than overwriting", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(1) })];
    const { result, rerender } = setup({ channels, open: false, activeChannelId: undefined });

    rerender({ channels: [makeChannel({ id: "group", messages: makeMessages(2) })], open: false, activeChannelId: undefined });
    expect(result.current.unreadByChannel["group"]).toBe(1);

    rerender({ channels: [makeChannel({ id: "group", messages: makeMessages(4) })], open: false, activeChannelId: undefined });
    expect(result.current.unreadByChannel["group"]).toBe(3);
  });

  test("6. switching activeChannelId clears only the newly active channel", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(3) }), makeChannel({ id: "room", messages: makeMessages(3) })];
    const { result, rerender } = setup({ channels, open: true, activeChannelId: "group" });

    rerender({
      channels: [makeChannel({ id: "group", messages: makeMessages(3) }), makeChannel({ id: "room", messages: makeMessages(5) })],
      open: true,
      activeChannelId: "group",
    });
    expect(result.current.unreadByChannel["room"]).toBe(2);

    rerender({
      channels: [makeChannel({ id: "group", messages: makeMessages(3) }), makeChannel({ id: "room", messages: makeMessages(5) })],
      open: true,
      activeChannelId: "room",
    });

    expect(result.current.unreadByChannel["room"]).toBe(0);
  });

  test("7. empty channels -> {} and totalUnread === 0", () => {
    const { result } = setup({ channels: [], open: false, activeChannelId: undefined });

    expect(result.current.unreadByChannel).toEqual({});
    expect(result.current.totalUnread).toBe(0);
  });

  test("8. totalUnread is the sum across all channels", () => {
    const channels = [makeChannel({ id: "group", messages: makeMessages(1) }), makeChannel({ id: "room", messages: makeMessages(1) })];
    const { result, rerender } = setup({ channels, open: false, activeChannelId: undefined });

    rerender({
      channels: [makeChannel({ id: "group", messages: makeMessages(3) }), makeChannel({ id: "room", messages: makeMessages(4) })],
      open: false,
      activeChannelId: undefined,
    });

    expect(result.current.totalUnread).toBe(2 + 3);
  });
});
