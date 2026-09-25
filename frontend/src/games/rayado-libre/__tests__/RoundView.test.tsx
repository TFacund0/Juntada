import { describe, test, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "../RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", accountId: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
    { id: "p2", accountId: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
  ];
}

function makeRoom(
  phase: string,
  roundOverrides: Record<string, unknown> = {},
  configOverrides: Record<string, unknown> = {},
): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "rayado-libre",
    phase,
    players: makePlayers(),
    maxPlayers: 8,
    groupCode: null,
    config: { score: {}, totalRounds: 2, enabledCategories: {}, ...configOverrides },
    round: {
      turnNumber: 1,
      totalTurns: 2,
      drawerId: "p1",
      chooseTimerEnd: null,
      timerEnd: null,
      strokes: [],
      chatLog: [],
      correctGuessers: [],
      roundPoints: {},
      wordHint: undefined,
      word: undefined,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
    chat: [],
  };
}

describe("Rayado Libre RoundView — choosing phase", () => {
  test("the drawer sees their word choices and picking one sends choose_word", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("choosing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, wordChoices: ["Perro", "Gato", "Casa"] }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Gato" }));
    expect(send).toHaveBeenCalledWith({ type: "choose_word", word: "Gato" });
  });

  test("a non-drawer sees a waiting message instead of word choices", () => {
    render(
      <RoundView
        room={makeRoom("choosing")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false, wordChoices: null }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText(/está eligiendo la palabra/)).toBeInTheDocument();
  });
});

describe("Rayado Libre RoundView — drawing phase", () => {
  test("a guesser submitting a guess sends it and clears the input", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("drawing", { wordHint: "_ _ _ _" })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false }}
        wordReveal={null}
        isHost={false}
        send={send}
      />,
    );

    const input = screen.getByPlaceholderText("Tu respuesta...");
    await user.type(input, "Perro");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(send).toHaveBeenCalledWith({ type: "guess", text: "Perro" });
    expect(input).toHaveValue("");
  });

  test("a guesser who already solved this turn sees a message instead of the guess input", () => {
    render(
      <RoundView
        room={makeRoom("drawing", { correctGuessers: ["p2"] })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText(/Ya adivinaste esta ronda/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Tu respuesta...")).not.toBeInTheDocument();
  });

  test("the drawer sees their own word and can toggle hiding it", async () => {
    const user = userEvent.setup();
    render(
      <RoundView
        room={makeRoom("drawing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    const word = screen.getByText("Perro");
    expect(word).toHaveStyle({ visibility: "visible" });
    await user.click(screen.getByRole("button", { name: "Ocultar palabra" }));
    expect(word).toHaveStyle({ visibility: "hidden" });
  });

  test("the drawer can reroll the word before anyone has guessed", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("drawing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro" }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByText(/Pedir otra palabra/));
    expect(send).toHaveBeenCalledWith({ type: "reroll_word" });
  });

  test("the reroll button is hidden once it was already used, or once someone has guessed", () => {
    const { rerender } = render(
      <RoundView
        room={makeRoom("drawing", { rerollUsed: true })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Pedir otra palabra/)).not.toBeInTheDocument();

    rerender(
      <RoundView
        room={makeRoom("drawing", { correctGuessers: ["p2"] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Pedir otra palabra/)).not.toBeInTheDocument();
  });
});

describe("Rayado Libre RoundView — drawing screen (turn header, players, clock)", () => {
  function renderGuesser(roundOverrides: Record<string, unknown>) {
    return (
      <RoundView
        room={makeRoom("drawing", roundOverrides, { score: { p1: 20, p2: 70 } })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />
    );
  }

  test("a guesser sees who draws and how many letters, and the players panel sorted by score", () => {
    render(renderGuesser({ wordHint: "_a__" }));
    expect(screen.getByText("Dibuja Ana · adiviná la palabra (4 letras)")).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "Jugadores" });
    const names = Array.from(panel.querySelectorAll(".truncate")).map(el => el.textContent);
    expect(names).toEqual(["Beto", "Ana"]);
    expect(panel).toHaveTextContent("✏️ dibujando");
  });

  test("the drawer sees the empty-board prompt with their word", () => {
    render(
      <RoundView
        room={makeRoom("drawing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("Dibujás vos · los demás adivinan")).toBeInTheDocument();
    expect(screen.getByText("Dibujá PERRO acá")).toBeInTheDocument();
  });

  test("the mute button toggles its label", async () => {
    const user = userEvent.setup();
    localStorage.clear();
    render(renderGuesser({ wordHint: "____" }));
    await user.click(screen.getByRole("button", { name: "Silenciar sonido" }));
    expect(screen.getByRole("button", { name: "Activar sonido" })).toBeInTheDocument();
    localStorage.clear();
  });

  test("a first correct guess that lowers the clock shows '¡El reloj saltó a N!'", () => {
    const now = Date.now();
    const { rerender } = render(renderGuesser({ wordHint: "____", timerEnd: now + 88_000 }));
    expect(screen.getByRole("status")).toHaveTextContent("");
    rerender(renderGuesser({ wordHint: "____", timerEnd: now + 60_000, correctGuessers: ["p2"] }));
    expect(screen.getByRole("status")).toHaveTextContent("¡El reloj saltó a 60!");
  });

  test("a reroll lowering the clock (no new guess) is not a jump", () => {
    const now = Date.now();
    const { rerender } = render(renderGuesser({ wordHint: "____", timerEnd: now + 88_000 }));
    rerender(renderGuesser({ wordHint: "____", timerEnd: now + 73_000 }));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});

describe("Rayado Libre RoundView — reveal phase", () => {
  test("tapping ready sends player_ready, then shows a waiting count", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("reveal", { word: "Perro" })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Perro")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Listo para/ }));
    expect(send).toHaveBeenCalledWith({ type: "player_ready" });
  });

  test("already-ready players see a waiting count instead of the button", () => {
    const room = makeRoom("reveal", { word: "Perro" });
    room.players[0].ready = true;
    render(
      <RoundView
        room={room}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={room.players[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Listo para/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Listo — esperando a los demás/)).toBeInTheDocument();
  });
});

describe("Rayado Libre RoundView — result phase", () => {
  // useRevealCountdown starts at 3 regardless of resetKey (see
  // RevealCountdown.tsx) — every "result" phase mount shows that countdown
  // first, so tests need to advance past it before the scoreboard appears.
  test("the host sees a 'Nueva partida' button that sends new_game", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", {}, { score: { p1: 10, p2: 6 } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(screen.getByText("Fin del juego")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(send).toHaveBeenCalledWith({ type: "new_game" });
    vi.useRealTimers();
  });

  test("a non-host sees a waiting message instead of the new-game button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <RoundView
        room={makeRoom("result")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );
    await act(() => vi.advanceTimersByTimeAsync(3000));

    expect(screen.queryByRole("button", { name: "Nueva partida" })).not.toBeInTheDocument();
    expect(screen.getByText("Esperando que el anfitrión inicie otra partida")).toBeInTheDocument();
    vi.useRealTimers();
  });
});
