import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RoomPublicState } from "@juntada/shared-types";
import { LobbyInfo } from "../components/LobbyInfo";

function makeRoom(configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "tutifruti",
    phase: "lobby",
    players: [{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }],
    maxPlayers: 16,
    groupCode: null,
    config: {
      rounds: 5,
      endMode: "timer",
      roundTime: 90,
      activeCategories: {},
      customCategories: [],
      ...configOverrides,
    },
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

describe("Tutifrutti LobbyInfo", () => {
  test("a custom category that's toggled off doesn't show as active", () => {
    render(
      <LobbyInfo
        room={makeRoom({
          customCategories: [{ id: "custom_1", label: "Superhéroes" }],
          activeCategories: { custom_1: false },
        })}
      />,
    );

    expect(screen.queryByText("Superhéroes")).not.toBeInTheDocument();
    expect(screen.getByText("El anfitrión todavía no activó categorías")).toBeInTheDocument();
  });

  test("a custom category that's active shows up, same as an active default one", () => {
    render(
      <LobbyInfo
        room={makeRoom({
          customCategories: [{ id: "custom_1", label: "Superhéroes" }],
          activeCategories: { custom_1: true },
        })}
      />,
    );

    expect(screen.getByText("Superhéroes")).toBeInTheDocument();
  });
});
