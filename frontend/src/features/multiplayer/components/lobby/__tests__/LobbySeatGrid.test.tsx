import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LobbySeatGrid } from "../LobbySeatGrid";
import { useLobbySeats, type Seat } from "../../../hooks/useLobbySeats";
import { renderHook } from "@testing-library/react";
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

function baseProps(room: RoomPublicState, seatsResult: ReturnType<typeof useLobbySeats>) {
  return {
    room,
    myPlayerId: "p1",
    isHost: true,
    visibleSeats: seatsResult.visibleSeats,
    hiddenSeatCount: seatsResult.hiddenSeatCount,
    totalSeatCount: seatsResult.seats.length,
    showAllSeats: seatsResult.showAllSeats,
    onShowAllSeats: vi.fn(),
    openPlayerMenu: null,
    onTogglePlayerMenu: vi.fn(),
    onTransferHost: vi.fn(),
    onKickPlayer: vi.fn(),
    onShowShareLink: vi.fn(),
  };
}

describe("LobbySeatGrid", () => {
  test("renders the players count header and a chip per player", () => {
    const room = makeRoom({ players: [makePlayer("p1"), makePlayer("p2")], maxPlayers: 4 });
    const { result } = renderHook(() => useLobbySeats(room));
    render(<LobbySeatGrid {...baseProps(room, result.current)} />);

    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByText("p1")).toBeInTheDocument();
    expect(screen.getByText("p2")).toBeInTheDocument();
  });

  test("empty seats are invitable when the room has no group code", () => {
    const room = makeRoom({ players: [makePlayer("p1")], maxPlayers: 2, groupCode: null });
    const { result } = renderHook(() => useLobbySeats(room));
    const onShowShareLink = vi.fn();
    render(<LobbySeatGrid {...baseProps(room, result.current)} onShowShareLink={onShowShareLink} />);

    screen.getByText("Invitar").closest("button")!.click();
    expect(onShowShareLink).toHaveBeenCalledWith(true);
  });

  test("empty seats are not invitable when the room belongs to a group", () => {
    const room = makeRoom({ players: [makePlayer("p1")], maxPlayers: 2, groupCode: "GRP01" });
    const { result } = renderHook(() => useLobbySeats(room));
    render(<LobbySeatGrid {...baseProps(room, result.current)} />);

    expect(screen.queryByText("Invitar")).not.toBeInTheDocument();
    expect(screen.getByText("Vacío")).toBeInTheDocument();
  });

  test("shows the +N button and calls onShowAllSeats(true) when there are more than 5 seats", () => {
    const room = makeRoom({ players: [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")], maxPlayers: 8 });
    const { result } = renderHook(() => useLobbySeats(room));
    const onShowAllSeats = vi.fn();
    render(<LobbySeatGrid {...baseProps(room, result.current)} onShowAllSeats={onShowAllSeats} />);

    const moreButton = screen.getByText("+3").closest("button")!;
    moreButton.click();
    expect(onShowAllSeats).toHaveBeenCalledWith(true);
  });

  test("shows 'Ver menos' and calls onShowAllSeats(false) when expanded with more than 5 total seats", () => {
    const room = makeRoom({ players: [makePlayer("p1"), makePlayer("p2"), makePlayer("p3")], maxPlayers: 8 });
    const { result } = renderHook(() => useLobbySeats(room));
    const onShowAllSeats = vi.fn();
    render(
      <LobbySeatGrid
        {...baseProps(room, result.current)}
        showAllSeats={true}
        visibleSeats={(room.players.map(player => ({ kind: "player" as const, player })) as Seat[]).concat(
          Array.from({ length: 5 }, (_, i) => ({ kind: "empty" as const, key: `empty-${i}` })),
        )}
        hiddenSeatCount={0}
        onShowAllSeats={onShowAllSeats}
      />,
    );

    screen.getByText("Ver menos").click();
    expect(onShowAllSeats).toHaveBeenCalledWith(false);
  });
});
