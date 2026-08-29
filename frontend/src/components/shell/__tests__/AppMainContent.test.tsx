import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppMainContent } from "../AppMainContent";
import type { AppOutletContext } from "../../../pages/AppOutletContext";
import type { GameDef } from "../../../games/gameTypes";

function baseOutletContext(): AppOutletContext {
  return {
    gameId: null,
    setGameId: vi.fn(),
    mode: null,
    setMode: vi.fn(),
    game: null,
    groupFlow: false,
    groupIntent: undefined,
    pendingGroupJoinCode: null,
    switchToGroupJoin: vi.fn(),
    setRoomCode: vi.fn(),
    setGroupCode: vi.fn(),
    groupAttached: false,
    setGroupAttached: vi.fn(),
    setRoomPhase: vi.fn(),
    handleRoomGameType: vi.fn(),
    GAME_LIST: [],
    exposeReturnToGroup: vi.fn(),
    exposeLocalGameBack: vi.fn(),
    exposeLocalGameReset: vi.fn(),
    playerName: "Ana",
    savePlayerName: vi.fn(),
    validJoinLink: null,
    curtain: "none",
    withCurtain: vi.fn(),
    withAsyncCurtain: vi.fn(),
    settleAsyncCurtain: vi.fn(),
    pickGame: vi.fn(),
    goHome: vi.fn(),
    goBack: vi.fn(),
  };
}

function renderAppMainContent(overrides: Partial<React.ComponentProps<typeof AppMainContent>> = {}) {
  const props: React.ComponentProps<typeof AppMainContent> = {
    gameId: null,
    mode: null,
    groupFlow: false,
    groupAttached: false,
    game: null,
    accentColor: "#7F77DD",
    mutedColor: "#6b6490",
    playerName: "Ana",
    savePlayerName: vi.fn(),
    goBack: vi.fn(),
    setShowExitConfirm: vi.fn(),
    showProfileMenu: false,
    setShowProfileMenu: vi.fn(),
    profileMenuRef: { current: null },
    startGroupFlow: vi.fn(),
    showRules: false,
    setShowRules: vi.fn(),
    stepKey: "picker",
    stepDirection: "forward",
    curtain: "none",
    outletContext: baseOutletContext(),
    inGameView: false,
    ...overrides,
  };

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<AppMainContent {...props} />}>
          <Route index element={<div data-testid="outlet-child" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("AppMainContent", () => {
  test("renders the header content and the routed outlet content", () => {
    renderAppMainContent();
    expect(screen.getByTestId("outlet-child")).toBeTruthy();
  });

  test("showRules=false hides GameRules content even with rules present", () => {
    const game = { rules: ["Paso uno"] } as unknown as GameDef;
    renderAppMainContent({ game, showRules: false, gameId: "impostor" });
    expect(screen.queryByText("Cómo se juega")).toBeNull();
  });

  test("showRules=true shows GameRules content when the game has rules", () => {
    const game = { rules: ["Paso uno"] } as unknown as GameDef;
    renderAppMainContent({ game, showRules: true, gameId: "impostor" });
    expect(screen.getByText("Cómo se juega")).toBeTruthy();
  });

  test("toggling rules via the header calls setShowRules", async () => {
    const setShowRules = vi.fn();
    const game = { rules: ["Paso uno"] } as unknown as GameDef;
    renderAppMainContent({ game, gameId: "impostor", mode: "local", setShowRules });
    const toggle = screen.getByRole("button", { name: "¿Cómo se juega?" });
    await userEvent.click(toggle);
    expect(setShowRules).toHaveBeenCalledTimes(1);
  });

  test("uses the jt-home-wrap layout for stepKey picker", () => {
    const { container } = renderAppMainContent({ stepKey: "picker" });
    expect(container.querySelector(".jt-home-wrap")).not.toBeNull();
  });

  test("uses the jt-content-pad-top layout for a game step", () => {
    const { container } = renderAppMainContent({ stepKey: "local-config" });
    expect(container.querySelector(".jt-content-pad-top")).not.toBeNull();
  });
});
