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
    gameType: "ruleta",
    phase: "lobby",
    players: [],
    maxPlayers: 16,
    groupCode: null,
    config: { entries: [], mode: "eliminate", ...configOverrides },
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

describe("Ruleta ConfigPanel", () => {
  test("defaults to the entries tab, with a hint to add at least 2", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText("Entradas (0)")).toBeInTheDocument();
    expect(screen.getByText("Cargá al menos 2 entradas")).toBeInTheDocument();
  });

  test("adding an entry sends the updated list to updateConfig and clears the form", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.type(screen.getByPlaceholderText(/Nombre/), "Juan");
    await user.type(screen.getByPlaceholderText(/Descripción/), "Canta una canción");
    await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));

    expect(updateConfig).toHaveBeenCalledWith({
      entries: [expect.objectContaining({ name: "Juan", description: "Canta una canción" })],
    });
    expect(screen.getByPlaceholderText(/Nombre/)).toHaveValue("");
  });

  test("removing an entry sends the list without it", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    const entries = [
      { id: "e1", name: "Juan", description: "" },
      { id: "e2", name: "Ana", description: "" },
    ];
    render(<ConfigPanel room={makeRoom({ entries })} updateConfig={updateConfig} />);

    const removeButtons = screen.getAllByRole("button", { name: "×" });
    await user.click(removeButtons[0]);
    expect(updateConfig).toHaveBeenCalledWith({ entries: [entries[1]] });
  });

  test("adding a duplicate name is rejected with an inline error, without calling updateConfig", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ entries: [{ id: "e1", name: "Juan", description: "" }] })} updateConfig={updateConfig} />);

    await user.type(screen.getByPlaceholderText(/Nombre/), "Juan");
    await user.click(screen.getByRole("button", { name: "Agregar a la ruleta" }));

    expect(updateConfig).not.toHaveBeenCalled();
    expect(screen.getByText(/Ya hay una entrada con ese nombre/)).toBeInTheDocument();
  });

  test("switching to the mode tab lets the host pick 'keep' instead of the default 'eliminate'", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByText("Modo"));
    expect(screen.getByText(/Repetir/)).toBeInTheDocument();

    await user.click(screen.getByText(/Repetir/));
    expect(updateConfig).toHaveBeenCalledWith({ mode: "keep" });
  });
});
