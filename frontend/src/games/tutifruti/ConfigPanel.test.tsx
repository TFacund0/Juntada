import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DEFAULT_CATEGORIES } from "@juntada/tutifruti-data";
import type { RoomPublicState } from "@juntada/shared-types";
import { ConfigPanel } from "./ConfigPanel";

function makeRoom(configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "tutifruti",
    phase: "lobby",
    players: [],
    config: {
      activeCategories: DEFAULT_CATEGORIES.reduce((a: Record<string, boolean>, c: { id: string }) => ({ ...a, [c.id]: true }), {}),
      customCategories: [],
      rounds: 5,
      endMode: "timer",
      roundTime: 90,
      ...configOverrides,
    },
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

describe("Tutifrutti ConfigPanel", () => {
  test("shows category toggles on the default tab", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText(/Nombre/)).toBeInTheDocument();
  });

  test("adding a custom category sends the updated list", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.type(screen.getByPlaceholderText("Nueva categoría..."), "Emoji");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(updateConfig).toHaveBeenCalledWith({ customCategories: [expect.objectContaining({ label: "Emoji" })] });
  });

  test("switching to the rules tab lets the host change the number of rounds", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom({ rounds: 5 })} updateConfig={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    expect(screen.getByText("Rondas: 5")).toBeInTheDocument();
  });

  test("switching end mode to 'basta' disables the round-time slider", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom({ endMode: "basta" })} updateConfig={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    expect(screen.getByText("Tiempo por ronda: No aplica")).toBeInTheDocument();
  });
});
