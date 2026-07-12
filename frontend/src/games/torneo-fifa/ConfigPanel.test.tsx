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
    gameType: "torneo-fifa",
    phase: "lobby",
    players: [
      { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
      { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
    ],
    config: {
      trackGoals: true,
      teams: ["Argentina", "Brasil", "Francia"],
      assignments: {},
      seedOrder: ["p1", "p2"],
      ...configOverrides,
    },
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

describe("Torneo FIFA ConfigPanel", () => {
  test("shows the configured teams", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText(/Equipos disponibles \(3\)/)).toBeInTheDocument();
  });

  test("adding a team sends the updated list", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.type(screen.getByPlaceholderText("Agregar equipo..."), "España");
    await user.click(screen.getByRole("button", { name: "Agregar" }));

    expect(updateConfig).toHaveBeenCalledWith({ teams: ["Argentina", "Brasil", "Francia", "España"] });
  });

  test("assigning a team manually to a player sends the updated assignments", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getAllByRole("button", { name: "Elegir equipo" })[0]);
    await user.click(screen.getByRole("button", { name: "Argentina" }));

    expect(updateConfig).toHaveBeenCalledWith({ assignments: { p1: "Argentina" } });
  });

  test("toggling goal tracking sends the inverse of the current value", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ trackGoals: true })} updateConfig={updateConfig} />);

    await user.click(screen.getByText(/Contabilizar goles/));
    expect(updateConfig).toHaveBeenCalledWith({ trackGoals: false });
  });
});
