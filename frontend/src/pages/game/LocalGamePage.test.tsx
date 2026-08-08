import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalGamePage } from "./LocalGamePage";
import type { AppOutletContext } from "../AppOutletContext";
import type { GameDef } from "../../games/gameTypes";

const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => outletContext() };
});

function fakeGame(overrides: Partial<GameDef> = {}): GameDef {
  return {
    id: "impostor",
    label: "Impostor",
    description: "",
    LocalGame: () => <div data-testid="local-game" />,
    ...overrides,
  };
}

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: "impostor",
    mode: "local",
    game: fakeGame(),
    exposeLocalGameBack: vi.fn(),
    exposeLocalGameReset: vi.fn(),
    ...overrides,
  };
}

describe("LocalGamePage", () => {
  test("renders the game's LocalGame when mode is local and game is set (guard met)", async () => {
    outletContext.mockReturnValue(baseContext());
    render(<LocalGamePage />);
    expect(await screen.findByTestId("local-game")).toBeTruthy();
  });

  test("renders nothing when mode is not local — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ mode: null }));
    const { container } = render(<LocalGamePage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when there is no game — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ game: null }));
    const { container } = render(<LocalGamePage />);
    expect(container.firstChild).toBeNull();
  });
});
