import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupOpenInstances } from "../GroupOpenInstances";
import type { GroupPublicState } from "@juntada/shared-types";

type Instance = GroupPublicState["instances"][number];

function makeInstance(overrides: Partial<Instance> = {}): Instance {
  return {
    roomCode: "ROOM1",
    gameType: "tateti",
    hostName: "Ana",
    phase: "lobby",
    playerCount: 1,
    maxPlayers: 4,
    ...overrides,
  } as Instance;
}

describe("GroupOpenInstances", () => {
  test("shows the empty state when there are no instances", () => {
    render(<GroupOpenInstances instances={[]} pendingJoinCode={null} onJoinInstance={vi.fn()} />);

    expect(screen.getByText("Nadie abrió una partida todavía.")).toBeInTheDocument();
  });

  test("a joinable instance (lobby, room not full) renders an active 'Unirse' button", () => {
    const inst = makeInstance({ phase: "lobby", playerCount: 1, maxPlayers: 4 });
    const onJoinInstance = vi.fn();
    render(<GroupOpenInstances instances={[inst]} pendingJoinCode={null} onJoinInstance={onJoinInstance} />);

    const button = screen.getByText("Unirse").closest("button")!;
    expect(button).not.toBeDisabled();
    button.click();
    expect(onJoinInstance).toHaveBeenCalledWith("ROOM1");
  });

  test("a full lobby instance renders disabled with 'llena' meta text", () => {
    const inst = makeInstance({ phase: "lobby", playerCount: 4, maxPlayers: 4 });
    render(<GroupOpenInstances instances={[inst]} pendingJoinCode={null} onJoinInstance={vi.fn()} />);

    expect(screen.getByText(/llena/)).toBeInTheDocument();
    expect(screen.getByText("—").closest("button")).toBeDisabled();
  });

  test("an in-progress instance renders disabled with 'en curso' meta text", () => {
    const inst = makeInstance({ phase: "playing", playerCount: 2, maxPlayers: 4 });
    render(<GroupOpenInstances instances={[inst]} pendingJoinCode={null} onJoinInstance={vi.fn()} />);

    expect(screen.getByText(/en curso/)).toBeInTheDocument();
    expect(screen.getByText("—").closest("button")).toBeDisabled();
  });

  test("shows the pending join label and disables the button while joining that instance", () => {
    const inst = makeInstance({ roomCode: "ROOM1", phase: "lobby", playerCount: 1, maxPlayers: 4 });
    render(<GroupOpenInstances instances={[inst]} pendingJoinCode="ROOM1" onJoinInstance={vi.fn()} />);

    const button = screen.getByText("Uniéndose...").closest("button")!;
    expect(button).toBeDisabled();
  });
});
