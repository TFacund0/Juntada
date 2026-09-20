import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GameNavbar } from "../GameNavbar";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomRoster } from "../../../pages/context/GameSessionContext";
import type { RoomPublicState } from "@juntada/shared-types";

const baseProps = {
  mode: null as "local" | "multi" | null,
  groupFlow: false,
  game: null as GameDef | null | undefined,
  accentColor: "#7f77dd",
  mutedColor: "#999",
  onBack: vi.fn(),
  onExit: vi.fn(),
  showRules: false,
  onToggleRules: () => {},
  backLabel: "Volver",
  roomRoster: null,
  roomActionRef: { current: vi.fn() },
};

function gameFixture(overrides: Partial<GameDef> = {}): GameDef {
  return {
    id: "impostor",
    label: "Impostor",
    description: "desc",
    LocalGame: () => null,
    ...overrides,
  } as GameDef;
}

function rosterFixture(overrides: Partial<RoomRoster> = {}): RoomRoster {
  const room = {
    code: "ABCDE",
    name: "Sala",
    hostId: "p1",
    gameType: "impostor",
    groupCode: null,
    phase: "round",
    players: [
      { id: "p1", accountId: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
      { id: "p2", accountId: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
    ],
    maxPlayers: 8,
    config: {},
    round: null,
    usedWords: {},
    roundHistory: [],
    chat: [],
  } as unknown as RoomPublicState;
  return { room, myPlayerId: "p1", ...overrides };
}

describe("GameNavbar", () => {
  test('falls back to "Juntada" when game is null', () => {
    render(<GameNavbar {...baseProps} game={null} />);
    expect(screen.getByText("Juntada")).toBeTruthy();
  });

  test("shows the game label when game is set", () => {
    render(<GameNavbar {...baseProps} game={gameFixture({ label: "Impostor" })} />);
    expect(screen.getByText("Impostor")).toBeTruthy();
  });

  test('subtitle is "Grupo" when groupFlow is true', () => {
    render(<GameNavbar {...baseProps} groupFlow={true} />);
    expect(screen.getByText("Grupo")).toBeTruthy();
  });

  test('subtitle is "Local · un dispositivo" for mode local', () => {
    render(<GameNavbar {...baseProps} groupFlow={false} mode="local" />);
    expect(screen.getByText("Local · un dispositivo")).toBeTruthy();
  });

  test('subtitle is "Online" for mode multi', () => {
    render(<GameNavbar {...baseProps} groupFlow={false} mode="multi" />);
    expect(screen.getByText("Online")).toBeTruthy();
  });

  test('subtitle is "Elegí cómo jugar" when mode is null and not groupFlow', () => {
    render(<GameNavbar {...baseProps} groupFlow={false} mode={null} />);
    expect(screen.getByText("Elegí cómo jugar")).toBeTruthy();
  });

  test("does not render the rules button when the game has no rules", () => {
    render(<GameNavbar {...baseProps} game={gameFixture({ rules: [] })} />);
    expect(screen.queryByLabelText("¿Cómo se juega?")).toBeNull();
  });

  test("renders the rules button when the game has rules", () => {
    render(<GameNavbar {...baseProps} game={gameFixture({ rules: ["regla 1"] })} />);
    expect(screen.getByLabelText("¿Cómo se juega?")).toBeTruthy();
  });

  test("showRules swaps the rules button icon from Help to Close", () => {
    const { container, rerender } = render(<GameNavbar {...baseProps} game={gameFixture({ rules: ["r1"] })} showRules={false} />);
    expect(container.querySelector('circle[cx="12"][cy="12"][r="10"]')).not.toBeNull();

    rerender(<GameNavbar {...baseProps} game={gameFixture({ rules: ["r1"] })} showRules={true} />);
    expect(container.querySelector('circle[cx="12"][cy="12"][r="10"]')).toBeNull();
  });

  test("back button aria-label equals backLabel and fires onBack", () => {
    const onBack = vi.fn();
    render(<GameNavbar {...baseProps} onBack={onBack} backLabel="Volver al grupo" />);
    const btn = screen.getByLabelText("Volver al grupo");
    fireEvent.click(btn);
    expect(onBack).toHaveBeenCalled();
  });

  test("exit button fires onExit", () => {
    const onExit = vi.fn();
    render(<GameNavbar {...baseProps} onExit={onExit} />);
    fireEvent.click(screen.getByLabelText("Menú principal"));
    expect(onExit).toHaveBeenCalled();
  });

  test("does not render the Jugadores button when roomRoster is null (local mode, or no room yet)", () => {
    render(<GameNavbar {...baseProps} roomRoster={null} />);
    expect(screen.queryByLabelText("Jugadores")).toBeNull();
  });

  test("renders the Jugadores button and opens the players dialog when roomRoster is set", () => {
    render(<GameNavbar {...baseProps} roomRoster={rosterFixture()} />);
    fireEvent.click(screen.getByLabelText("Jugadores"));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Beto")).toBeTruthy();
  });

  test("host can kick a player from the Jugadores dialog", () => {
    const roomActionRef = { current: vi.fn() };
    render(<GameNavbar {...baseProps} roomActionRef={roomActionRef} roomRoster={rosterFixture({ myPlayerId: "p1" })} />);
    fireEvent.click(screen.getByLabelText("Jugadores"));
    fireEvent.click(screen.getByLabelText("Opciones para Beto"));
    fireEvent.click(screen.getByText("Expulsar de la sala"));

    expect(roomActionRef.current).toHaveBeenCalledWith({ type: "kick_player", targetId: "p2" });
  });

  test("a non-host cannot manage other players from the Jugadores dialog", () => {
    render(<GameNavbar {...baseProps} roomRoster={rosterFixture({ myPlayerId: "p2" })} />);
    fireEvent.click(screen.getByLabelText("Jugadores"));
    expect(screen.queryByLabelText("Opciones para Ana")).toBeNull();
  });
});
