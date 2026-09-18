import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameNavbar } from "../GameNavbar";
import type { GameDef } from "../../../games/gameTypes";

const baseProps = {
  mode: null as "local" | "multi" | null,
  groupFlow: false,
  game: null as GameDef | null | undefined,
  accentColor: "#7f77dd",
  mutedColor: "#999",
  onBack: vi.fn(),
  onExit: vi.fn(),
  showRules: false,
  onToggleRules: () => {},
  backLabel: "Volver",
};

function gameFixture(overrides: Partial<GameDef> = {}): GameDef {
  return {
    id: "impostor",
    label: "Impostor",
    description: "desc",
    LocalGame: () => null,
    ...overrides,
  } as GameDef;
}

describe("GameNavbar", () => {
  test('falls back to "Juntada" when game is null', () => {
    render(<GameNavbar {...baseProps} game={null} />);
    expect(screen.getByText("Juntada")).toBeTruthy();
  });

  test("shows the game label when game is set", () => {
    render(<GameNavbar {...baseProps} game={gameFixture({ label: "Impostor" })} />);
    expect(screen.getByText("Impostor")).toBeTruthy();
  });

  test('subtitle is "Grupo" when groupFlow is true', () => {
    render(<GameNavbar {...baseProps} groupFlow={true} />);
    expect(screen.getByText("Grupo")).toBeTruthy();
  });

  test('subtitle is "Local · un dispositivo" for mode local', () => {
    render(<GameNavbar {...baseProps} groupFlow={false} mode="local" />);
    expect(screen.getByText("Local · un dispositivo")).toBeTruthy();
  });

  test('subtitle is "Online" for mode multi', () => {
    render(<GameNavbar {...baseProps} groupFlow={false} mode="multi" />);
    expect(screen.getByText("Online")).toBeTruthy();
  });

  test('subtitle is "Elegí cómo jugar" when mode is null and not groupFlow', () => {
    render(<GameNavbar {...baseProps} groupFlow={false} mode={null} />);
    expect(screen.getByText("Elegí cómo jugar")).toBeTruthy();
  });

  test("does not render the rules button when the game has no rules", () => {
    render(<GameNavbar {...baseProps} game={gameFixture({ rules: [] })} />);
    expect(screen.queryByLabelText("¿Cómo se juega?")).toBeNull();
  });

  test("renders the rules button when the game has rules", () => {
    render(<GameNavbar {...baseProps} game={gameFixture({ rules: ["regla 1"] })} />);
    expect(screen.getByLabelText("¿Cómo se juega?")).toBeTruthy();
  });

  test("showRules swaps the rules button icon from Help to Close", () => {
    const { container, rerender } = render(<GameNavbar {...baseProps} game={gameFixture({ rules: ["r1"] })} showRules={false} />);
    expect(container.querySelector('circle[cx="12"][cy="12"][r="10"]')).not.toBeNull();

    rerender(<GameNavbar {...baseProps} game={gameFixture({ rules: ["r1"] })} showRules={true} />);
    expect(container.querySelector('circle[cx="12"][cy="12"][r="10"]')).toBeNull();
  });

  test("back button aria-label equals backLabel and fires onBack", () => {
    const onBack = vi.fn();
    render(<GameNavbar {...baseProps} onBack={onBack} backLabel="Volver al grupo" />);
    const btn = screen.getByLabelText("Volver al grupo");
    fireEvent.click(btn);
    expect(onBack).toHaveBeenCalled();
  });

  test("exit button fires onExit", () => {
    const onExit = vi.fn();
    render(<GameNavbar {...baseProps} onExit={onExit} />);
    fireEvent.click(screen.getByLabelText("Menú principal"));
    expect(onExit).toHaveBeenCalled();
  });
});
