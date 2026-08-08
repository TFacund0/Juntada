import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomPage } from "./RoomPage";
import type { AppOutletContext } from "./AppOutletContext";

const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => outletContext() };
});

vi.mock("../features/multiplayer/MultiplayerGame", () => ({
  MultiplayerGame: (props: { entryKind: string; gameId: string | null }) => (
    <div data-testid="multiplayer-game" data-entry-kind={props.entryKind} data-game-id={props.gameId ?? ""} />
  ),
}));

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: "impostor",
    mode: "multi",
    groupFlow: false,
    game: null,
    playerName: "Ana",
    savePlayerName: vi.fn(),
    pendingGroupJoinCode: null,
    validJoinLink: null,
    groupIntent: undefined,
    handleRoomGameType: vi.fn(),
    setRoomPhase: vi.fn(),
    setRoomCode: vi.fn(),
    setGroupCode: vi.fn(),
    goHome: vi.fn(),
    goBack: vi.fn(),
    switchToGroupJoin: vi.fn(),
    setGroupAttached: vi.fn(),
    exposeReturnToGroup: vi.fn(),
    withAsyncCurtain: vi.fn(),
    settleAsyncCurtain: vi.fn(),
    curtain: "none",
    ...overrides,
  };
}

describe("RoomPage", () => {
  test("renders MultiplayerGame with entryKind room for a direct room entry (guard met)", async () => {
    outletContext.mockReturnValue(baseContext());
    render(<RoomPage />);
    const el = await screen.findByTestId("multiplayer-game");
    expect(el.dataset.entryKind).toBe("room");
    expect(el.dataset.gameId).toBe("impostor");
  });

  test("renders nothing when mode is not multi — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ mode: "local" }));
    const { container } = render(<RoomPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when there is no gameId — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ gameId: null }));
    const { container } = render(<RoomPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when a group flow is active (belongs to GroupPage)", () => {
    outletContext.mockReturnValue(baseContext({ groupFlow: true }));
    const { container } = render(<RoomPage />);
    expect(container.firstChild).toBeNull();
  });
});
