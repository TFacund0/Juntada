import { describe, expect, test } from "vitest";
import { buildChatFeed, eligibleGuessers } from "../utils/chatFeed";
import { isNearBottom, newMessagesLabel } from "../utils/chatScroll";
import type { ChatEntry } from "../types/roundView";

const players = [
  { id: "p1", name: "Ana" },
  { id: "p2", name: "Beto" },
  { id: "p3", name: "Caro" },
];

describe("buildChatFeed", () => {
  const chatLog: ChatEntry[] = [
    { id: 1, type: "chat", playerId: "p2", text: "perr" },
    { id: 2, type: "chat", playerId: "p3", text: "gato" },
    { id: 3, type: "correct", playerId: "p3" },
    { id: 4, type: "chat", playerId: "gone", text: "hola" },
  ];

  test("turns the log into own/others' messages and correct lines with points, after the system line", () => {
    const items = buildChatFeed({
      chatLog,
      players,
      myId: "p2",
      closeEntryIds: [],
      roundPoints: { p3: 60 },
      systemLine: "Ana está dibujando…",
    });
    expect(items).toEqual([
      { kind: "sys", key: "sys", text: "Ana está dibujando…" },
      { kind: "msg", key: "1", playerId: "p2", name: "Beto", mine: true, close: false, text: "perr" },
      { kind: "msg", key: "2", playerId: "p3", name: "Caro", mine: false, close: false, text: "gato" },
      { kind: "ok", key: "3", playerId: "p3", name: "Caro", mine: false, points: 60 },
    ]);
  });

  test("marks my own close guesses, and only mine even if someone else's id sneaks in", () => {
    const items = buildChatFeed({ chatLog, players, myId: "p2", closeEntryIds: [1, 2], roundPoints: {} });
    const close = items.filter(i => i.kind === "msg" && i.close).map(i => i.key);
    expect(close).toEqual(["1"]);
  });

  test("a correct line never carries the word", () => {
    const items = buildChatFeed({ chatLog, players, myId: "p3", closeEntryIds: [], roundPoints: { p3: 45 } });
    expect(items.find(i => i.kind === "ok")).toEqual({ kind: "ok", key: "3", playerId: "p3", name: "Caro", mine: true, points: 45 });
  });
});

describe("eligibleGuessers", () => {
  test("everyone but the drawer, minus offline players who haven't guessed", () => {
    const roster = [
      { id: "p1", online: true },
      { id: "p2", online: true },
      { id: "p3", online: false },
      { id: "p4", online: false },
    ];
    expect(eligibleGuessers(roster, "p1", ["p4"])).toBe(2);
  });
});

describe("chat scroll rules", () => {
  test("near the bottom means less than 40px left to scroll", () => {
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 561, clientHeight: 400 })).toBe(true);
    expect(isNearBottom({ scrollHeight: 1000, scrollTop: 560, clientHeight: 400 })).toBe(false);
  });

  test("the new-messages pill counts in singular and plural", () => {
    expect(newMessagesLabel(1)).toBe("↓ 1 nuevo");
    expect(newMessagesLabel(3)).toBe("↓ 3 nuevos");
  });
});
