import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState } from "@juntada/shared-types";
import { buildDefaultDescriptions } from "./deck";
import { ConfigPanel } from "./ConfigPanel";

function makeRoom(configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "limon-limon",
    phase: "lobby",
    players: [
      { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
      { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
    ],
    maxPlayers: 16,
    groupCode: null,
    config: {
      descriptions: buildDefaultDescriptions(),
      turnOrder: ["p1", "p2"],
      ...configOverrides,
    },
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

describe("Limón Limón ConfigPanel", () => {
  test("shows the turn order", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText("Orden de turno")).toBeInTheDocument();
    expect(screen.getByText("Jugador 1")).toBeInTheDocument();
    expect(screen.getByText("Jugador 2")).toBeInTheDocument();
  });

  test("moving a player down swaps the turn order", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getAllByRole("button", { name: "↓" })[0]);
    expect(updateConfig).toHaveBeenCalledWith({ turnOrder: ["p2", "p1"] });
  });
});
