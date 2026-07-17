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
    gameType: "torneo-futbol",
    phase: "lobby",
    players: [
      { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
      { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
    ],
    maxPlayers: 16,
    groupCode: null,
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

describe("Torneo de Fútbol ConfigPanel", () => {
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

    await user.click(screen.getByRole("button", { name: "Asignar" }));
    await user.click(screen.getAllByRole("button", { name: "Elegir equipo" })[0]);
    await user.click(screen.getByRole("button", { name: "Argentina" }));

    expect(updateConfig).toHaveBeenCalledWith({ assignments: { p1: "Argentina" } });
  });

  test("Cruces preview gives each trailing entrant their own solo bye, matching buildBracket exactly", async () => {
    const user = userEvent.setup();
    const players = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Jugador ${i + 1}`,
      ready: false,
      online: true,
      hasVoted: false,
    }));
    const room = makeRoom({ seedOrder: players.map(p => p.id) });
    room.players = players;
    render(<ConfigPanel room={room} updateConfig={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cruces" }));

    // 5 entrants -> nextPowerOf2 = 8, byeCount = 3, normalPairs = 1: only
    // Jugador 1 vs Jugador 2 is a real match; Jugadores 3/4/5 each get their
    // own solo bye card — never paired with each other.
    expect(screen.getByText("Cruce 1")).toBeInTheDocument();
    expect(screen.getAllByText("Pasa directo (bye)")).toHaveLength(3);
    expect(screen.getByText("Jugador 3")).toBeInTheDocument();
    expect(screen.getByText("Jugador 4")).toBeInTheDocument();
    expect(screen.getByText("Jugador 5")).toBeInTheDocument();
  });

  test("toggling goal tracking sends the inverse of the current value", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ trackGoals: true })} updateConfig={updateConfig} />);

    await user.click(screen.getByText(/Contabilizar goles/));
    expect(updateConfig).toHaveBeenCalledWith({ trackGoals: false });
  });
});
