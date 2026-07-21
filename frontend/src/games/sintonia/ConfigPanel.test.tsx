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
    gameType: "sintonia",
    phase: "lobby",
    players: [],
    maxPlayers: 16,
    groupCode: null,
    config: { score: {}, lastPsychicId: null, playMode: "endless", roundLimit: 5, ...configOverrides },
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

describe("Sintonía ConfigPanel", () => {
  test("defaults to endless mode with no round-limit slider", () => {
    render(<ConfigPanel room={makeRoom()} updateConfig={vi.fn()} />);
    expect(screen.getByText(/Libre \(sin límite\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Cantidad de rondas/)).not.toBeInTheDocument();
  });

  test("switching to rounds mode sends the update and shows the slider", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);
    await user.click(screen.getByText("Por rondas"));
    expect(updateConfig).toHaveBeenCalledWith({ playMode: "rounds" });
  });

  test("shows the round-limit slider once in rounds mode", () => {
    render(<ConfigPanel room={makeRoom({ playMode: "rounds", roundLimit: 8 })} updateConfig={vi.fn()} />);
    expect(screen.getByText(/Cantidad de rondas: 8/)).toBeInTheDocument();
  });
});
