import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ModePickerPage } from "../ModePickerPage";
import type { AppOutletContext } from "../../AppOutletContext";
import type { GameDef } from "../../../games/gameTypes";

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
    LocalGame: () => null,
    ...overrides,
  };
}

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: "impostor",
    mode: null,
    game: fakeGame(),
    setMode: vi.fn(),
    withCurtain: vi.fn(),
    ...overrides,
  };
}

describe("ModePickerPage", () => {
  test("renders the mode picker for an available, non-localOnly game (guard met)", () => {
    outletContext.mockReturnValue(baseContext());
    const { container } = render(<ModePickerPage />);
    expect(container.firstChild).not.toBeNull();
  });

  test("renders nothing once a mode is already chosen — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ mode: "multi" }));
    const { container } = render(<ModePickerPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing for a localOnly game", () => {
    outletContext.mockReturnValue(baseContext({ game: fakeGame({ localOnly: true }) }));
    const { container } = render(<ModePickerPage />);
    expect(container.firstChild).toBeNull();
  });
});
