import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupPage } from "./GroupPage";
import type { AppOutletContext } from "../AppOutletContext";

const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => outletContext() };
});

vi.mock("../../features/multiplayer/MultiplayerGame", () => ({
  MultiplayerGame: (props: { entryKind: string; gameId: string | null }) => (
    <div data-testid="multiplayer-game" data-entry-kind={props.entryKind} data-game-id={props.gameId ?? ""} />
  ),
}));

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: null,
    mode: "multi",
    groupFlow: true,
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

describe("GroupPage", () => {
  test("renders MultiplayerGame with entryKind group for an active group flow (guard met)", async () => {
    outletContext.mockReturnValue(baseContext());
    render(<GroupPage />);
    const el = await screen.findByTestId("multiplayer-game");
    expect(el.dataset.entryKind).toBe("group");
  });

  test("renders MultiplayerGame with entryKind group even with a gameId set (group instance running one)", async () => {
    outletContext.mockReturnValue(baseContext({ gameId: "impostor" }));
    render(<GroupPage />);
    const el = await screen.findByTestId("multiplayer-game");
    expect(el.dataset.entryKind).toBe("group");
    expect(el.dataset.gameId).toBe("impostor");
  });

  test("renders nothing when mode is not multi — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ mode: null }));
    const { container } = render(<GroupPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when there is no group flow — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ groupFlow: false, gameId: "impostor" }));
    const { container } = render(<GroupPage />);
    expect(container.firstChild).toBeNull();
  });
});
