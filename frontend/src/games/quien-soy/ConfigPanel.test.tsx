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
    gameType: "quien-soy",
    phase: "lobby",
    players: [
      { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
      { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
      { id: "p3", name: "Caro", ready: false, online: true, hasVoted: false },
    ],
    maxPlayers: 8,
    groupCode: null,
    config: { score: {}, wordSource: "categories", activeCategories: {}, turnOrder: [], ...configOverrides },
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

describe("¿Quién Soy? ConfigPanel", () => {
  test("defaults to categories, showing the category toggles", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Categorías" })).toBeInTheDocument();
    expect(screen.getByText("Personajes Famosos")).toBeInTheDocument();
  });

  test("switching to 'Sugeridas y votadas' hides the category toggles", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByText("Sugeridas y votadas"));
    expect(updateConfig).toHaveBeenCalledWith({ wordSource: "suggested" });
  });

  test("no category toggles shown once wordSource is 'suggested'", () => {
    render(<ConfigPanel room={makeRoom({ wordSource: "suggested" })} updateConfig={vi.fn()} />);
    expect(screen.queryByText("Personajes Famosos")).not.toBeInTheDocument();
  });

  test("toggling a category sends the updated activeCategories map", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ activeCategories: { animales: true } })} updateConfig={updateConfig} />);

    await user.click(screen.getByText("Personajes Famosos"));
    expect(updateConfig).toHaveBeenCalledWith({ activeCategories: { animales: true, "personajes-famosos": true } });
  });

  test("with no custom order yet, switching to manual sends room order as the starting point", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByText("Orden manual"));
    expect(updateConfig).toHaveBeenCalledWith({ turnOrder: ["p1", "p2", "p3"] });
  });

  test("with a manual order already set, reordering sends the swapped order", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ turnOrder: ["p1", "p2", "p3"] })} updateConfig={updateConfig} />);

    const [downButton] = screen.getAllByRole("button", { name: "↓" });
    await user.click(downButton);
    expect(updateConfig).toHaveBeenCalledWith({ turnOrder: ["p2", "p1", "p3"] });
  });
});
