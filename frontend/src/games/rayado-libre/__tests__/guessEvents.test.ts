import { describe, expect, test } from "vitest";
import { localGuessEvents, onlineGuessEvents } from "../utils/guessEvents";
import { localRoundPoints } from "../utils/localTurn";
import type { ChatEntry } from "../types/roundView";

const colorOf = (name: string) => `color-${name}`;

describe("onlineGuessEvents", () => {
  test("one event per correct line, keyed by the chat id; skips chat and players who left", () => {
    const chatLog: ChatEntry[] = [
      { id: 1, type: "chat", playerId: "p2", text: "perro" },
      { id: 2, type: "correct", playerId: "p2" },
      { id: 3, type: "correct", playerId: "gone" },
      { id: 4, type: "correct", playerId: "p3" },
    ];
    const events = onlineGuessEvents({
      chatLog,
      players: [
        { id: "p2", name: "Beto" },
        { id: "p3", name: "Caro" },
      ],
      roundPoints: { p2: 60 },
      myId: "p3",
      colorOf,
    });
    expect(events).toEqual([
      { key: "2", color: "color-Beto", points: 60, mine: false },
      { key: "4", color: "color-Caro", points: 0, mine: true },
    ]);
  });
});

describe("localGuessEvents", () => {
  test("in the order they were marked, anchored to each player's button", () => {
    const events = localGuessEvents({
      correctGuessers: [3, 1],
      players: [
        { id: 1, name: "Ana" },
        { id: 3, name: "Caro" },
      ],
      points: { 1: 40, 3: 60 },
      colorOf,
    });
    expect(events).toEqual([
      { key: "guess-3", color: "color-Caro", points: 60, mine: false },
      { key: "guess-1", color: "color-Ana", points: 40, mine: false },
    ]);
  });
});

describe("localRoundPoints", () => {
  test("adds 10 per guess to the drawer, like the online engine", () => {
    expect(localRoundPoints({ 2: 60, 3: 31 }, 1)).toEqual({ 1: 20, 2: 60, 3: 31 });
  });

  test("nobody guessed: the drawer gets nothing", () => {
    expect(localRoundPoints({}, 1)).toEqual({});
  });
});
