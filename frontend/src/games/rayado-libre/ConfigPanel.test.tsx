import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState } from "@juntada/shared-types";
import { ConfigPanel } from "./ConfigPanel";

function makeRoom(configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "rayado-libre",
    phase: "lobby",
    players: [],
    maxPlayers: 16,
    groupCode: null,
    config: { score: {}, totalRounds: 3, enabledCategories: {}, ...configOverrides },
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

describe("Rayado Libre ConfigPanel", () => {
  test("shows 'no category chosen yet' with nothing enabled", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText("No elegiste ninguna categoría todavía.")).toBeInTheDocument();
  });

  test("toggling a category sends the updated map and updates the active count", () => {
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ enabledCategories: { comida: true } })} updateConfig={updateConfig} />);
    expect(screen.getByText("1 categoría activa.")).toBeInTheDocument();
  });

  test("clicking a category button toggles it on", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByText("Animales"));
    expect(updateConfig).toHaveBeenCalledWith({ enabledCategories: { animales: true } });
  });

  test("'Todas' enables every category, 'Ninguna' disables all", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByText("Todas"));
    const allEnabled = updateConfig.mock.calls[0][0].enabledCategories;
    expect(Object.values(allEnabled).every(Boolean)).toBe(true);

    await user.click(screen.getByText("Ninguna"));
    const allDisabled = updateConfig.mock.calls[1][0].enabledCategories;
    expect(Object.values(allDisabled).every(v => v === false)).toBe(true);
  });

  test("picking a rounds count sends the update", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    expect(screen.getByText(/cada jugador dibuja 3 veces/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "5" }));
    expect(updateConfig).toHaveBeenCalledWith({ totalRounds: 5 });
  });
});
