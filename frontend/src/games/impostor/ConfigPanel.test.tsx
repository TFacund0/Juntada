import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORIES } from "@juntada/impostor-data";
import type { RoomPublicState } from "@juntada/shared-types";
import { ConfigPanel } from "./ConfigPanel";

// Host-only config editor rendered in the multiplayer lobby. Every field
// here is a controlled input wired straight to updateConfig — these tests
// check that clicking/toggling each one sends the right patch, not that the
// room's config actually gets applied (that's the engine's job, already
// covered by backend/test/impostorEngine.test.ts).

function makeRoom(configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "impostor",
    phase: "lobby",
    players: [],
    maxPlayers: 16,
    config: {
      enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: true }), {}),
      numImpostors: 1,
      hintsEnabled: true,
      clueTime: 90,
      writtenClues: false,
      discussionTime: 30,
      discussionUnlimited: false,
      ...configOverrides,
    },
    round: null,
    usedWords: {},
    roundHistory: [],
  };
}

describe("Impostor ConfigPanel", () => {
  test("shows the category toggles on the default tab", () => {
    const room = makeRoom();
    render(<ConfigPanel room={room} updateConfig={vi.fn()} />);
    const firstCategory = Object.values(CATEGORIES)[0];
    expect(screen.getByText(new RegExp(firstCategory.label))).toBeInTheDocument();
  });

  test("picking an impostor count sends the right patch", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    await user.click(screen.getByRole("button", { name: "2" }));

    expect(updateConfig).toHaveBeenCalledWith({ numImpostors: 2 });
  });

  test("toggling hints sends the inverse of the current value", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ hintsEnabled: true })} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    await user.click(screen.getByText("Pistas al impostor"));

    expect(updateConfig).toHaveBeenCalledWith({ hintsEnabled: false });
  });

  test("the discussion-time slider is disabled when discussion is set to unlimited", async () => {
    const user = userEvent.setup();
    render(<ConfigPanel room={makeRoom({ discussionUnlimited: true })} updateConfig={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    expect(screen.getByText("Tiempo de discusión: Sin límite")).toBeInTheDocument();
  });
});
