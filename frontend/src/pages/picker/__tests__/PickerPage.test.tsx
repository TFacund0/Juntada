import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PickerPage } from "../PickerPage";
import type { GameSessionContextValue } from "../../context/GameSessionContext";
import type { AppShellContextValue } from "../../context/AppShellContext";

const gameSession = vi.fn<() => Partial<GameSessionContextValue>>();
const appShell = vi.fn<() => Partial<AppShellContextValue>>();
vi.mock("../../context/GameSessionContext", () => ({ useGameSessionContext: () => gameSession() }));
vi.mock("../../context/AppShellContext", () => ({ useAppShellContext: () => appShell() }));

function baseSession(overrides: Partial<GameSessionContextValue> = {}): Partial<GameSessionContextValue> {
  return {
    gameId: null,
    groupFlow: false,
    GAME_LIST: [],
    ...overrides,
  };
}

describe("PickerPage", () => {
  test("renders the game picker when no game/group is chosen (guard met)", () => {
    gameSession.mockReturnValue(baseSession());
    appShell.mockReturnValue({ pickGame: vi.fn() });
    const { container } = render(<PickerPage />);
    expect(container.querySelector("#jt-games")).not.toBeNull();
  });

  test("renders nothing when a game is already chosen — one-render lag guard", () => {
    gameSession.mockReturnValue(baseSession({ gameId: "impostor" }));
    appShell.mockReturnValue({ pickGame: vi.fn() });
    const { container } = render(<PickerPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when a group flow is already active — one-render lag guard", () => {
    gameSession.mockReturnValue(baseSession({ groupFlow: true }));
    appShell.mockReturnValue({ pickGame: vi.fn() });
    const { container } = render(<PickerPage />);
    expect(container.firstChild).toBeNull();
  });
});
