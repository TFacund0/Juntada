import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocalOnlyGamePage } from "./LocalOnlyGamePage";
import type { AppOutletContext } from "./AppOutletContext";
import type { GameDef } from "../games/gameTypes";

const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => outletContext() };
});

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

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: "trivia",
    mode: null,
    game: fakeGame(),
    ...overrides,
  };
}

describe("LocalOnlyGamePage", () => {
  test("renders the game's LocalGame for an available localOnly game with no mode (guard met)", async () => {
    outletContext.mockReturnValue(baseContext());
    render(<LocalOnlyGamePage />);
    expect(await screen.findByTestId("local-game")).toBeTruthy();
  });

  test("renders nothing when a mode is already set — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ mode: "local" }));
    const { container } = render(<LocalOnlyGamePage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing for a non-localOnly game", () => {
    outletContext.mockReturnValue(baseContext({ game: fakeGame({ localOnly: false }) }));
    const { container } = render(<LocalOnlyGamePage />);
    expect(container.firstChild).toBeNull();
  });
});
