import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalOnlyGamePage } from "../LocalOnlyGamePage";
import type { GameSessionContextValue } from "../../context/GameSessionContext";
import type { GameDef } from "../../../games/gameTypes";

const gameSession = vi.fn<() => Partial<GameSessionContextValue>>();
vi.mock("../../context/GameSessionContext", () => ({ useGameSessionContext: () => gameSession() }));

function fakeGame(overrides: Partial<GameDef> = {}): GameDef {
  return {
    id: "trivia",
    label: "Trivia",
    description: "",
    localOnly: true,
    LocalGame: () => <div data-testid="local-game" />,
    ...overrides,
  };
}

function baseContext(overrides: Partial<GameSessionContextValue> = {}): Partial<GameSessionContextValue> {
  return {
    gameId: "trivia",
    mode: null,
    game: fakeGame(),
    ...overrides,
  };
}

describe("LocalOnlyGamePage", () => {
  test("renders the game's LocalGame for an available localOnly game with no mode (guard met)", async () => {
    gameSession.mockReturnValue(baseContext());
    render(<LocalOnlyGamePage />);
    expect(await screen.findByTestId("local-game")).toBeTruthy();
  });

  test("renders nothing when a mode is already set — one-render lag guard", () => {
    gameSession.mockReturnValue(baseContext({ mode: "local" }));
    const { container } = render(<LocalOnlyGamePage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing for a non-localOnly game", () => {
    gameSession.mockReturnValue(baseContext({ game: fakeGame({ localOnly: false }) }));
    const { container } = render(<LocalOnlyGamePage />);
    expect(container.firstChild).toBeNull();
  });
});
