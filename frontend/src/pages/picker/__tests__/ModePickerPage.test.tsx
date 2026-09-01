import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ModePickerPage } from "../ModePickerPage";
import type { GameSessionContextValue } from "../../context/GameSessionContext";
import type { CurtainContextValue } from "../../context/CurtainContext";
import type { GameDef } from "../../../games/gameTypes";

const gameSession = vi.fn<() => Partial<GameSessionContextValue>>();
const curtain = vi.fn<() => Partial<CurtainContextValue>>();
vi.mock("../../context/GameSessionContext", () => ({ useGameSessionContext: () => gameSession() }));
vi.mock("../../context/CurtainContext", () => ({ useCurtainContext: () => curtain() }));

function fakeGame(overrides: Partial<GameDef> = {}): GameDef {
  return {
    id: "impostor",
    label: "Impostor",
    description: "",
    LocalGame: () => null,
    ...overrides,
  };
}

function baseSession(overrides: Partial<GameSessionContextValue> = {}): Partial<GameSessionContextValue> {
  return {
    gameId: "impostor",
    mode: null,
    game: fakeGame(),
    setMode: vi.fn(),
    ...overrides,
  };
}

describe("ModePickerPage", () => {
  test("renders the mode picker for an available, non-localOnly game (guard met)", () => {
    gameSession.mockReturnValue(baseSession());
    curtain.mockReturnValue({ withCurtain: vi.fn() });
    const { container } = render(<ModePickerPage />);
    expect(container.firstChild).not.toBeNull();
  });

  test("renders nothing once a mode is already chosen — one-render lag guard", () => {
    gameSession.mockReturnValue(baseSession({ mode: "multi" }));
    curtain.mockReturnValue({ withCurtain: vi.fn() });
    const { container } = render(<ModePickerPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing for a localOnly game", () => {
    gameSession.mockReturnValue(baseSession({ game: fakeGame({ localOnly: true }) }));
    curtain.mockReturnValue({ withCurtain: vi.fn() });
    const { container } = render(<ModePickerPage />);
    expect(container.firstChild).toBeNull();
  });
});
