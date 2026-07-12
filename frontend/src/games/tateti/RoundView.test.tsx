import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "./RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
    { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
  ];
}

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}, configOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "tateti",
    phase,
    players: makePlayers(),
    maxPlayers: 16,
    config: { score: {}, draws: 0, resetVotes: [], ...configOverrides },
    round: {
      board: Array(9).fill(null),
      marks: { p1: "X", p2: "O" },
      turn: "p1",
      winningLine: null,
      winner: null,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
  };
}

function boardCells() {
  return screen.getAllByRole("button").filter(b => ["·", "X", "O"].includes(b.textContent ?? ""));
}

afterEach(() => vi.useRealTimers());

describe("Ta-Te-Ti RoundView — round phase", () => {
  test("clicking a cell on my turn sends a mark", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Tu turno")).toBeInTheDocument();
    await user.click(boardCells()[0]);
    expect(send).toHaveBeenCalledWith({ type: "mark", index: 0 });
  });

  test("the board is disabled when it's the opponent's turn", () => {
    render(
      <RoundView
        room={makeRoom("round", { turn: "p2" })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Turno de Jugador 2")).toBeInTheDocument();
    boardCells().forEach(c => expect(c).toBeDisabled());
  });

  test("requesting a scoreboard reset sends reset_score_vote", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("round")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Reiniciar marcador" }));
    expect(send).toHaveBeenCalledWith({ type: "reset_score_vote" });
  });

  test("shows a confirm button when the opponent already voted to reset", () => {
    render(
      <RoundView
        room={makeRoom("round", {}, { resetVotes: ["p2"] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Jugador 2 pidió reiniciar el marcador — confirmar")).toBeInTheDocument();
  });
});

describe("Ta-Te-Ti RoundView — result phase", () => {
  beforeEach(() => vi.useFakeTimers());

  test("reveals the result after the countdown and lets me ready up for a rematch", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", { winner: "p1", board: ["X", "X", "X", null, "O", "O", null, null, null], winningLine: [0, 1, 2] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.queryByText("¡Ganaste!")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("¡Ganaste!")).toBeInTheDocument();

    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));
    expect(send).toHaveBeenCalledWith({ type: "player_ready" });
  });

  test("a draw shows 'Empate' for both players", async () => {
    render(
      <RoundView
        room={makeRoom("result", { winner: "draw" })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Empate")).toBeInTheDocument();
  });
});
