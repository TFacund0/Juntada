import { describe, test, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLobbySeats } from "../useLobbySeats";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";

function makePlayer(id: string, overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return { id, name: id, ready: false, online: true, hasVoted: false, ...overrides } as PublicPlayer;
}

function makeRoom(overrides: Partial<RoomPublicState> = {}): RoomPublicState {
  return {
    code: "ABCDE",
    name: "Mi sala",
    hostId: "p1",
    gameType: "tateti",
    groupCode: null,
    phase: "lobby",
    players: [makePlayer("p1")],
    maxPlayers: 4,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
    ...overrides,
  } as RoomPublicState;
}

describe("useLobbySeats", () => {
  test("pads seats with empty slots up to maxPlayers", () => {
    const room = makeRoom({ players: [makePlayer("p1"), makePlayer("p2")], maxPlayers: 4 });
    const { result } = renderHook(() => useLobbySeats(room));

    expect(result.current.seats).toHaveLength(4);
    expect(result.current.seats[0]).toEqual({ kind: "player", player: room.players[0] });
    expect(result.current.seats[2]).toEqual({ kind: "empty", key: "empty-0" });
    expect(result.current.seats[3]).toEqual({ kind: "empty", key: "empty-1" });
  });

  test("collapses to 5 visible seats when there are more than 5", () => {
    const room = makeRoom({
      players: [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")],
      maxPlayers: 8,
    });
    const { result } = renderHook(() => useLobbySeats(room));

    expect(result.current.seats).toHaveLength(8);
    expect(result.current.visibleSeats).toHaveLength(5);
    expect(result.current.hiddenSeatCount).toBe(3);
  });

  test("does not collapse when total seats is 5 or fewer", () => {
    const room = makeRoom({ players: [makePlayer("p1")], maxPlayers: 5 });
    const { result } = renderHook(() => useLobbySeats(room));

    expect(result.current.visibleSeats).toHaveLength(5);
    expect(result.current.hiddenSeatCount).toBe(0);
  });

  test("expanding via setShowAllSeats reveals every seat and toggling back collapses again", () => {
    const room = makeRoom({ players: [makePlayer("p1")], maxPlayers: 8 });
    const { result } = renderHook(() => useLobbySeats(room));

    expect(result.current.showAllSeats).toBe(false);
    expect(result.current.visibleSeats).toHaveLength(5);

    act(() => result.current.setShowAllSeats(true));
    expect(result.current.showAllSeats).toBe(true);
    expect(result.current.visibleSeats).toHaveLength(8);
    expect(result.current.hiddenSeatCount).toBe(0);

    act(() => result.current.setShowAllSeats(false));
    expect(result.current.showAllSeats).toBe(false);
    expect(result.current.visibleSeats).toHaveLength(5);
    expect(result.current.hiddenSeatCount).toBe(3);
  });

  test("never produces negative empty seat count when players exceed maxPlayers", () => {
    const room = makeRoom({
      players: [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")],
      maxPlayers: 2,
    });
    const { result } = renderHook(() => useLobbySeats(room));

    expect(result.current.seats).toHaveLength(3);
    expect(result.current.seats.every(seat => seat.kind === "player")).toBe(true);
  });
});
