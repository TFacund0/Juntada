import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import type { RoomPublicState } from "@juntada/shared-types";
import { ConfigPanel } from "../ConfigPanel";

function makeRoom(configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "tutifruti",
    phase: "lobby",
    players: [],
    maxPlayers: 16,
    groupCode: null,
    config: {
      activeCategories: DEFAULT_CATEGORIES.reduce((a: Record<string, boolean>, c: { id: string }) => ({ ...a, [c.id]: false }), {}),
      customCategories: [],
      rounds: 5,
      endMode: "timer",
      roundTime: 90,
      ...configOverrides,
    },
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

describe("Tutifrutti ConfigPanel", () => {
  test("shows rules on the default tab, with categories hidden until picked", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText("Rondas: 5")).toBeInTheDocument();
    expect(screen.queryByText(/Nombre/)).not.toBeInTheDocument();
  });

  test("switching to the categories tab shows the full list, with add-category up top", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Categorías" }));
    expect(screen.getByText(/Nombre/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nueva categoría...")).toBeInTheDocument();
  });

  test("adding a custom category sends the updated list", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Categorías" }));
    await user.type(screen.getByPlaceholderText("Nueva categoría..."), "Emoji");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(updateConfig).toHaveBeenCalledWith({
      customCategories: [expect.objectContaining({ label: "Emoji" })],
      activeCategories: expect.any(Object),
    });
  });

  test("switching to the rules tab lets the host change the number of rounds", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom({ rounds: 5 })} updateConfig={vi.fn()} />);

    expect(screen.getByText("Rondas: 5")).toBeInTheDocument();
  });

  test("switching end mode to 'basta' disables the round-time slider", async () => {
    render(<ConfigPanel room={makeRoom({ endMode: "basta" })} updateConfig={vi.fn()} />);

    expect(screen.getByText("Tiempo por ronda: No aplica")).toBeInTheDocument();
  });

  test("picking 'Aleatorias' sends randomCategoryMode", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Categorías" }));
    expect(screen.getByText(/Nombre/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Aleatorias" }));
    expect(updateConfig).toHaveBeenCalledWith({ randomCategoryMode: true });
  });

  test("random category mode hides the manual toggle list and shows the count slider", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom({ randomCategoryMode: true, randomCategoryCount: 4 })} updateConfig={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Categorías" }));
    expect(screen.getByText("Cantidad de categorías por ronda: 4")).toBeInTheDocument();
    expect(screen.queryByText(/^Nombre$/)).not.toBeInTheDocument();
  });

  test("active categories summary can be expanded to show which ones are on", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom({ activeCategories: { nombre: true } })} updateConfig={vi.fn()} />);

    expect(screen.getByText("1 categoría activa")).toBeInTheDocument();
    expect(screen.queryByText(/Nombre/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver cuáles" }));
    expect(screen.getByText(/Nombre/)).toBeInTheDocument();
  });
});
