import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CATEGORIES } from "@juntada/impostor-data";
import type { RoomPublicState } from "@juntada/shared-types";
import { ConfigPanel } from "../ConfigPanel";

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
    players: [
      { id: "p1", accountId: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
      { id: "p2", accountId: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
      { id: "p3", accountId: "p3", name: "Caro", ready: false, online: true, hasVoted: false },
      { id: "p4", accountId: "p4", name: "Dana", ready: false, online: true, hasVoted: false },
      { id: "p5", accountId: "p5", name: "Emi", ready: false, online: true, hasVoted: false },
    ],
    maxPlayers: 16,
    groupCode: null,
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
    chat: [],
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

  test("disables impostor counts that would leave them a majority or tied with the innocents", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    const room = makeRoom();
    room.players = room.players.slice(0, 3); // 3 players -> max 1 impostor
    render(<ConfigPanel room={room} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    expect(screen.getByRole("button", { name: "2" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "2" }));
    expect(updateConfig).not.toHaveBeenCalled();
  });

  test("picking 'a ciegas' turns hints off", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom({ hintsEnabled: true })} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Reglas" }));
    await user.click(screen.getByRole("button", { name: "No, a ciegas" }));

    expect(updateConfig).toHaveBeenCalledWith({ hintsEnabled: false });
  });

  test("picking a category toggles it on", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    const room = makeRoom({ enabledCategories: Object.keys(CATEGORIES).reduce((a, k) => ({ ...a, [k]: false }), {}) });
    render(<ConfigPanel room={room} updateConfig={updateConfig} />);

    const firstKey = Object.keys(CATEGORIES)[0];
    const firstCategory = CATEGORIES[firstKey as keyof typeof CATEGORIES] as any;
    await user.click(screen.getByText(firstCategory.label));

    expect(updateConfig).toHaveBeenCalledWith({
      enabledCategories: expect.objectContaining({ [firstKey]: true }),
    });
  });

  test("moving the discussion-time slider reports the new time and clears unlimited", async () => {
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    fireEvent.click(screen.getByRole("button", { name: "Reglas" }));
    // clueTime's slider renders first, discussionTime's second.
    const [, discussionSlider] = screen.getAllByRole("slider");
    fireEvent.change(discussionSlider, { target: { value: "60" } });

    expect(updateConfig).toHaveBeenCalledWith({ discussionTime: 60, discussionUnlimited: false });
  });

  test("moving a player down in the turn order sends the swapped order", async () => {
    const user = userEvent.setup();
    const updateConfig = vi.fn();
    render(<ConfigPanel room={makeRoom()} updateConfig={updateConfig} />);

    await user.click(screen.getByRole("button", { name: "Orden" }));
    const [downButton] = screen.getAllByRole("button", { name: "↓" });
    await user.click(downButton);

    expect(updateConfig).toHaveBeenCalledWith({ turnOrder: ["p2", "p1", "p3", "p4", "p5"] });
  });
});
