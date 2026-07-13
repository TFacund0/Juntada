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

const ENTRANT_A = { id: "p1", name: "Jugador 1", team: "Argentina" };
const ENTRANT_B = { id: "p2", name: "Jugador 2", team: "Brasil" };

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "torneo-futbol",
    phase,
    players: makePlayers(),
    maxPlayers: 16,
    groupCode: null,
    config: {},
    round: {
      trackGoals: true,
      rounds: [[{ a: ENTRANT_A, b: ENTRANT_B, winner: null, goalsA: null, goalsB: null }]],
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
  };
}

afterEach(() => vi.useRealTimers());

describe("Torneo de Fútbol RoundView — bracket phase", () => {
  test("the host can load a score and it reports the result", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("bracket")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cargar resultado" }));
    const inputs = screen.getAllByRole("spinbutton");
    await user.type(inputs[0], "2");
    await user.type(inputs[1], "1");
    await user.click(screen.getByRole("button", { name: "Confirmar resultado" }));

    expect(send).toHaveBeenCalledWith({ type: "report_result", roundIdx: 0, matchIdx: 0, goalsA: 2, goalsB: 1 });
  });

  test("with goal tracking off, the host picks a winner directly", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("bracket", { trackGoals: false })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cargar resultado" }));
    await user.click(screen.getByRole("button", { name: "Ganó Jugador 1" }));

    expect(send).toHaveBeenCalledWith({ type: "report_result", roundIdx: 0, matchIdx: 0, winnerSide: "a" });
  });

  test("non-host players see a waiting message instead of load-result controls", () => {
    render(
      <RoundView
        room={makeRoom("bracket")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Es tu partido — esperá a que el anfitrión cargue el resultado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cargar resultado" })).not.toBeInTheDocument();
  });
});

describe("Torneo de Fútbol RoundView — champion phase", () => {
  beforeEach(() => vi.useFakeTimers());

  test("reveals the champion after the countdown", async () => {
    render(
      <RoundView
        room={makeRoom("champion", { rounds: [[{ a: ENTRANT_A, b: ENTRANT_B, winner: ENTRANT_A, goalsA: 2, goalsB: 1 }]] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Sos el campeón del torneo/)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText(/Sos el campeón del torneo/)).toBeInTheDocument();
  });
});
