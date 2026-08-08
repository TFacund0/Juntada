import { describe, test, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "../RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
    { id: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
  ];
}

function makeRoom(
  phase: string,
  roundOverrides: Record<string, unknown> = {},
  configOverrides: Record<string, unknown> = {},
  roundHistoryLength = 0,
): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "color-correcto",
    phase,
    players: makePlayers(),
    maxPlayers: 16,
    groupCode: null,
    config: { score: {}, playMode: "endless", roundLimit: 5, guessSeconds: 0, ...configOverrides },
    round: {
      target: "#336699",
      showEndsAt: null,
      guessEndsAt: null,
      submittedCount: 0,
      guessersOnline: 2,
      guesses: null,
      scores: null,
      playMode: "endless",
      roundLimit: 5,
      roundsPlayed: 0,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: Array.from({ length: roundHistoryLength }, () => ({})),
    chat: [],
  };
}

describe("Encuentra el Color Correcto RoundView — show phase", () => {
  test("shows the target color swatch", () => {
    render(
      <RoundView
        room={makeRoom("show")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.getByTestId("target-swatch")).toBeInTheDocument();
  });
});

describe("Encuentra el Color Correcto RoundView — guess phase", () => {
  test("submitting a guess sends the hex value and locks in the picker", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("guess")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ myGuess: null }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(send).toHaveBeenCalledWith({ type: "submit_guess", value: expect.stringMatching(/^#[0-9a-f]{6}$/) });
    expect(screen.getByText("Elección enviada")).toBeInTheDocument();
  });

  test("a guess already on file (reconnect mid-round) skips straight to the submitted view", () => {
    render(
      <RoundView
        room={makeRoom("guess", { submittedCount: 1 })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ myGuess: "#abcdef" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Elección enviada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar" })).not.toBeInTheDocument();
  });

  test("shows a force-finish banner (host only) when someone's offline", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    const room = makeRoom("guess");
    room.players[1].online = false;
    render(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={room.players[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText(/Esperando a que se reconecte/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Terminar la ronda con los intentos ya enviados" }));
    expect(send).toHaveBeenCalledWith({ type: "force_finish_round" });
  });

  test("a non-host doesn't see the force-finish button", () => {
    const room = makeRoom("guess");
    room.players[1].online = false;
    render(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={room.players[0]}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText(/Esperando a que se reconecte/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Terminar la ronda/ })).not.toBeInTheDocument();
  });
});

describe("Encuentra el Color Correcto RoundView — result phase", () => {
  test("after the reveal countdown, shows the leaderboard and each player's comparison row", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const scores = { p1: 9.2, p2: 5.4 };
    const guesses = { p1: "#336699", p2: "#ff0000" };
    render(
      <RoundView
        room={makeRoom("result", { scores, guesses }, { score: { p1: 9.2, p2: 5.4 } }, 1)}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={{ target: "#336699" }}
        isHost={true}
        send={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(screen.getAllByText("Jugador 1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Jugador 2").length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  test("the host sees 'Nueva ronda' before the round limit, or 'Nueva partida' once it's reached", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { rerender } = render(
      <RoundView
        room={makeRoom("result", {}, { playMode: "rounds", roundLimit: 3, roundsPlayed: 1 }, 1)}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={{ target: "#336699" }}
        isHost={true}
        send={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(screen.getByRole("button", { name: "Nueva ronda" })).toBeInTheDocument();

    rerender(
      <RoundView
        room={makeRoom("result", { playMode: "rounds", roundLimit: 3, roundsPlayed: 3 }, { playMode: "rounds", roundLimit: 3 }, 1)}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={{ target: "#336699" }}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Nueva partida" })).toBeInTheDocument();
    vi.useRealTimers();
  });

  test("a non-host sees a waiting message instead of the next-round button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <RoundView
        room={makeRoom("result", {}, {}, 1)}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={null}
        wordReveal={{ target: "#336699" }}
        isHost={false}
        send={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(screen.queryByRole("button", { name: /Nueva/ })).not.toBeInTheDocument();
    expect(screen.getByText("Esperando que el anfitrión inicie otra ronda")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
