import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalGamePage } from "../LocalGamePage";
import type { GameSessionContextValue } from "../../context/GameSessionContext";
import type { GameBridgeContextValue } from "../../context/GameBridgeContext";
import type { GameDef } from "../../../games/gameTypes";

const gameSession = vi.fn<() => Partial<GameSessionContextValue>>();
const gameBridge = vi.fn<() => Partial<GameBridgeContextValue>>();
vi.mock("../../context/GameSessionContext", () => ({ useGameSessionContext: () => gameSession() }));
vi.mock("../../context/GameBridgeContext", () => ({ useGameBridgeContext: () => gameBridge() }));

function fakeGame(overrides: Partial<GameDef> = {}): GameDef {
  return {
    id: "impostor",
    label: "Impostor",
    description: "",
    LocalGame: () => <div data-testid="local-game" />,
    ...overrides,
  };
}

function baseSession(overrides: Partial<GameSessionContextValue> = {}): Partial<GameSessionContextValue> {
  return {
    gameId: "impostor",
    mode: "local",
    game: fakeGame(),
    ...overrides,
  };
}

describe("LocalGamePage", () => {
  test("renders the game's LocalGame when mode is local and game is set (guard met)", async () => {
    gameSession.mockReturnValue(baseSession());
    gameBridge.mockReturnValue({ exposeLocalGameBack: vi.fn(), exposeLocalGameReset: vi.fn() });
    render(<LocalGamePage />);
    expect(await screen.findByTestId("local-game")).toBeTruthy();
  });

  test("renders nothing when mode is not local — one-render lag guard", () => {
    gameSession.mockReturnValue(baseSession({ mode: null }));
    gameBridge.mockReturnValue({ exposeLocalGameBack: vi.fn(), exposeLocalGameReset: vi.fn() });
    const { container } = render(<LocalGamePage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when there is no game — one-render lag guard", () => {
    gameSession.mockReturnValue(baseSession({ game: null }));
    gameBridge.mockReturnValue({ exposeLocalGameBack: vi.fn(), exposeLocalGameReset: vi.fn() });
    const { container } = render(<LocalGamePage />);
    expect(container.firstChild).toBeNull();
  });
});
