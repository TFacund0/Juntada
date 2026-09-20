import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "../RoundView";

function makePlayers(n: number): PublicPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    accountId: `p${i + 1}`,
    name: `Jugador ${i + 1}`,
    ready: false,
    online: true,
    hasVoted: false,
  }));
}

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}, players = makePlayers(3)): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "sintonia",
    phase,
    players,
    maxPlayers: 16,
    groupCode: null,
    config: { score: {} },
    round: {
      psychicId: "p1",
      left: "Frío",
      right: "Calor",
      target: 50,
      clue: null,
      guesses: {},
      submittedCount: 0,
      guessersOnline: 2,
      suggestedPsychicId: "p1",
      lastSpectrum: null,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

afterEach(() => vi.useRealTimers());

describe("Sintonía RoundView — setup phase", () => {
  test("non-host players see a waiting message", () => {
    render(
      <RoundView
        room={makeRoom("setup")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", accountId: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("Esperando que el anfitrión configure la ronda...")).toBeInTheDocument();
  });

  test("host confirming the round setup sends confirm_round_setup", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("setup")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continuar" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: "confirm_round_setup", psychicId: "p1" }));
  });
});

describe("Sintonía RoundView — spectrum phase", () => {
  test("the psychic can lock in a random spectrum with no host approval needed", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("spectrum", { left: null, right: null, target: null })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isPsychic: true, target: null }}
        wordReveal={null}
        isHost={false}
        send={send}
      />,
    );

    // "Random" mode picks (and previews) a pair up front so the psychic can
    // see it — and re-roll — before committing, instead of leaving it to
    // the server to pick at confirm time. Confirming submits that exact
    // previewed pair as a manual override.
    await user.click(screen.getByRole("button", { name: "Confirmar y ver el objetivo" }));
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: "submit_spectrum", mode: "manual", left: expect.any(String), right: expect.any(String) }),
    );
    const [{ left, right }] = send.mock.calls[0];
    expect(left).not.toBe("");
    expect(right).not.toBe("");
  });

  test("non-psychic players see a compact status card while the psychic picks", () => {
    render(
      <RoundView
        room={makeRoom("spectrum", { left: null, right: null, target: null })}
        me={{ playerId: "p3", roomCode: "TEST1" }}
        myPlayer={{ id: "p3", accountId: "p3", name: "Jugador 3", ready: false, online: true, hasVoted: false }}
        myRole={{ isPsychic: false, target: null }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Jugador 1 es el psíquico")).toBeInTheDocument();
    expect(screen.getByText("Está eligiendo el par de conceptos para esta ronda...")).toBeInTheDocument();
  });
});

describe("Sintonía RoundView — clue phase", () => {
  test("the psychic can type and submit a clue", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("clue")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isPsychic: true, target: 50 }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.type(screen.getByPlaceholderText("Escribí tu pista..."), "Templado");
    await user.click(screen.getByRole("button", { name: "Enviar pista" }));

    expect(send).toHaveBeenCalledWith({ type: "submit_clue", clue: "Templado" });
    expect(screen.getByText("Pista enviada — esperando que adivinen")).toBeInTheDocument();
  });

  test("non-psychic players see who the psychic is instead of an input", () => {
    render(
      <RoundView
        room={makeRoom("clue")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", accountId: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={{ isPsychic: false }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Jugador 1 es el psíquico")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Escribí tu pista...")).not.toBeInTheDocument();
  });
});

describe("Sintonía RoundView — guess phase", () => {
  test("a guesser can move the slider and confirm their guess", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("guess", { clue: "Templado" })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", accountId: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={{ isPsychic: false }}
        wordReveal={null}
        isHost={false}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Confirmar adivinanza" }));
    expect(send).toHaveBeenCalledWith({ type: "submit_guess", value: 50 });
    expect(screen.getByText("Adivinanza enviada")).toBeInTheDocument();
  });

  test("the psychic sees the waiting count instead of a slider", () => {
    render(
      <RoundView
        room={makeRoom("guess", { clue: "Templado", submittedCount: 1 })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={{ isPsychic: true }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Esperando que adivinen: 1/2")).toBeInTheDocument();
  });
});

describe("Sintonía RoundView — result phase", () => {
  beforeEach(() => vi.useFakeTimers());

  test("reveals the result after the countdown, and the host can start a new round", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", { clue: "Templado", psychicBonus: 4, pointsByPlayer: { p1: 4, p2: 4 }, guesses: { p2: 48 } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.queryByText("Puntos de la ronda")).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Puntos de la ronda")).toBeInTheDocument();

    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nueva ronda" }));
    expect(send).toHaveBeenCalledWith({ type: "start_round" });
  });

  test("'Volver al lobby' asks for confirmation before sending back_to_lobby", async () => {
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", { clue: "Templado", psychicBonus: 4, pointsByPlayer: { p1: 4, p2: 4 } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={true}
        send={send}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    vi.useRealTimers();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));
    expect(send).not.toHaveBeenCalledWith({ type: "back_to_lobby" });
    expect(screen.getByText("¿Volver al lobby?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("¿Volver al lobby?")).not.toBeInTheDocument();
    expect(send).not.toHaveBeenCalledWith({ type: "back_to_lobby" });

    await user.click(screen.getByRole("button", { name: "Volver al lobby" }));
    await user.click(screen.getAllByRole("button", { name: "Volver al lobby" })[1]);
    expect(send).toHaveBeenCalledWith({ type: "back_to_lobby" });
  });

  test("non-host players see a waiting message instead of round controls", async () => {
    render(
      <RoundView
        room={makeRoom("result", { clue: "Templado", psychicBonus: 4, pointsByPlayer: { p1: 4, p2: 4 } })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={{ id: "p2", accountId: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={false}
        send={vi.fn()}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Esperando que el anfitrión inicie otra ronda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva ronda" })).not.toBeInTheDocument();
  });

  test("endless mode shows only the scoreboard, with this round's own points beside the running total", async () => {
    render(
      <RoundView
        room={makeRoom("result", {
          clue: "Templado",
          psychicBonus: 4,
          pointsByPlayer: { p1: 4, p2: 4 },
          playMode: "endless",
        })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false }}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={true}
        send={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.queryByText("Puntos de la ronda")).not.toBeInTheDocument();
    expect(screen.getByText("Tabla de puntuación")).toBeInTheDocument();
    vi.useRealTimers();
    await userEvent.setup().click(screen.getByText("Tabla de puntuación")); // Collapsible starts closed
    expect(screen.getAllByText("+4")).toHaveLength(2); // p1 and p2 both scored 4 this round
  });

  test("rounds mode's last round hides the winner/scoreboard behind a vote, only revealing them once everyone's tapped through", async () => {
    const send = vi.fn();
    const players: PublicPlayer[] = [
      { id: "p1", accountId: "p1", name: "Jugador 1", ready: false, online: true, hasVoted: false },
      { id: "p2", accountId: "p2", name: "Jugador 2", ready: false, online: true, hasVoted: false },
      { id: "p3", accountId: "p3", name: "Jugador 3", ready: false, online: true, hasVoted: false },
    ];
    const room = makeRoom(
      "result",
      { clue: "Templado", psychicBonus: 4, pointsByPlayer: { p1: 4, p2: 4 }, playMode: "rounds", roundLimit: 1, roundsPlayed: 1 },
      players,
    );
    room.config = { score: { p1: 10, p2: 4, p3: 2 } };

    const { rerender } = render(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={players[0]}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={true}
        send={send}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    // Not revealed yet — nobody's voted, so no winner, no scoreboard, no
    // "Nueva partida" button either.
    expect(screen.queryByText("Partida terminada")).not.toBeInTheDocument();
    expect(screen.queryByText("Tabla de puntuación")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nueva partida" })).not.toBeInTheDocument();
    vi.useRealTimers();

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Ver resultados finales" }));
    expect(send).toHaveBeenCalledWith({ type: "player_ready" });

    // The click only sends the vote — the "Listo, esperando..." message only
    // shows once the server broadcasts it back as part of room.players.
    const myVoteRoom = { ...room, players: players.map(p => (p.id === "p1" ? { ...p, ready: true } : p)) };
    rerender(
      <RoundView
        room={myVoteRoom}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ ...players[0], ready: true }}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={true}
        send={send}
      />,
    );
    expect(screen.getByText("Listo — esperando a los demás para ver los resultados finales")).toBeInTheDocument();

    // Everyone else votes too — the same room update that flips their
    // `ready` flags is what actually reveals it, nothing local to this vote.
    const readyRoom = {
      ...room,
      players: players.map(p => ({ ...p, ready: true })),
    };
    rerender(
      <RoundView
        room={readyRoom}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={{ ...players[0], ready: true }}
        myRole={null}
        wordReveal={{ target: 50, left: "Frío", right: "Calor" }}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Partida terminada")).toBeInTheDocument();
    expect(screen.getByText("Tabla de puntuación")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva partida" })).toBeInTheDocument();
  });
});
