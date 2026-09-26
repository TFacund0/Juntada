import { describe, test, expect, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
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

  test("the cards show each word's category, and the auto-pick countdown uses the real choose timer", () => {
    render(
      <RoundView
        room={makeRoom("choosing", { chooseTimerEnd: Date.now() + 12_000 })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, wordChoices: ["Perro", "Gato", "Chiste interno"] }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Te toca dibujar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perro" })).toHaveAccessibleDescription("Animales");
    // Una palabra propia del anfitrión no viene de ninguna categoría.
    expect(screen.getByRole("button", { name: "Chiste interno" })).toHaveAccessibleDescription("Palabra propia");
    expect(screen.getByText(/^Se elige sola en 1[12]s$/)).toBeInTheDocument();
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

    const input = screen.getByPlaceholderText("Escribí lo que ves…");
    await user.type(input, "Perro");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(send).toHaveBeenCalledWith({ type: "guess", text: "Perro" });
    expect(input).toHaveValue("");
  });

  test("a guesser who already solved this turn gets a locked input with the word, and no Enviar button", () => {
    render(
      <RoundView
        room={makeRoom("drawing", { correctGuessers: ["p2"] })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false, guessedWord: "Perro" }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("¡Era PERRO! Esperá al resto…")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });

  test("the drawer sees the answers chat but no input", () => {
    render(
      <RoundView
        room={makeRoom("drawing", { chatLog: [{ id: 1, type: "chat", playerId: "p2", text: "¿un perro?" }] })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Gato" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("¿un perro?")).toBeInTheDocument();
    expect(screen.getByText("Dibujá sin letras ni números. Cuanto antes adivinen, más puntos.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Tu respuesta" })).not.toBeInTheDocument();
  });

  test("typing sends a 'typing' ping at most once every 2s, and only with text", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("drawing", { wordHint: "_____" })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false }}
        wordReveal={null}
        isHost={false}
        send={send}
      />,
    );
    const typingPings = () => send.mock.calls.filter(([m]) => m.type === "typing").length;

    const input = screen.getByRole("textbox", { name: "Tu respuesta" });
    await user.type(input, "per");
    expect(typingPings()).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await user.type(input, "r");
    expect(typingPings()).toBe(2);
    await user.clear(input);
    await act(() => vi.advanceTimersByTimeAsync(2000));
    await user.type(input, " ");
    expect(typingPings()).toBe(2);
    vi.useRealTimers();
  });

  test("others typing show under the chat and in the players panel, and switch off by themselves", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const players = [...makePlayers(), { id: "p3", accountId: "p3", name: "Caro", ready: false, online: true, hasVoted: false }];
    const room = makeRoom("drawing", { wordHint: "_____", typingUntil: { p3: Date.now() + 4000 } });
    room.players = players;
    render(
      <RoundView
        room={room}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={players[1]}
        myRole={{ isDrawer: false }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Caro está escribiendo…")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Jugadores" })).toHaveTextContent("escribiendo");
    await act(() => vi.advanceTimersByTimeAsync(4100));
    expect(screen.queryByText("Caro está escribiendo…")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  test("my own 'close' guess shows the yellow hint only for me; others see it as a plain message", () => {
    const chatLog = [{ id: 7, type: "chat", playerId: "p2", text: "perr" }];
    const { rerender } = render(
      <RoundView
        room={makeRoom("drawing", { chatLog })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ isDrawer: false, closeEntryIds: [7] }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("¡Estás cerca! · solo lo ves vos")).toBeInTheDocument();

    rerender(
      <RoundView
        room={makeRoom("drawing", { chatLog })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro", closeEntryIds: [] }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("perr")).toBeInTheDocument();
    expect(screen.queryByText("¡Estás cerca! · solo lo ves vos")).not.toBeInTheDocument();
  });

  test("a correct guess shows as a green line with the points but never the word", () => {
    render(
      <RoundView
        room={makeRoom("drawing", {
          chatLog: [{ id: 3, type: "correct", playerId: "p2" }],
          correctGuessers: ["p2"],
          roundPoints: { p2: 60, p1: 10 },
        })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ isDrawer: true, word: "Perro" }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.getByText("Beto adivinó · +60")).toBeInTheDocument();
    expect(screen.getByText("1/1 ✓")).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Siguiente turno" }));
    expect(send).toHaveBeenCalledWith({ type: "player_ready" });
  });

  test("on the last turn the button says 'Ver podio'", () => {
    render(
      <RoundView
        room={makeRoom("reveal", { word: "Perro", turnNumber: 2 })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Ver podio" })).toBeInTheDocument();
  });

  test("the turn table explains each score and is sorted by the new totals", () => {
    const room = makeRoom(
      "reveal",
      { word: "Perro", roundPoints: { p2: 57, p1: 10 }, guessSeconds: { p2: 57 }, correctGuessers: ["p2"] },
      { score: { p1: 40, p2: 67 } },
    );
    room.players.push({ id: "p3", accountId: "p3", name: "Caro", ready: false, online: true, hasVoted: false });
    render(
      <RoundView
        room={room}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={room.players[1]}
        myRole={null}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole("listitem").map(r => r.textContent);
    // Avatar (inicial), nombre y motivo, "+N" y total.
    expect(rows).toEqual(["BBeto (vos)adivinó con 57s+5767", "AAna ✏️+10 por cada acierto+1040", "CCarono adivinó+00"]);
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

    expect(screen.queryByRole("button", { name: "Siguiente turno" })).not.toBeInTheDocument();
    expect(screen.getByText(/Listo — esperando a los demás/)).toBeInTheDocument();
  });
});

describe("Rayado Libre RoundView — result phase", () => {
  test("the winning host sees '¡Ganaste!' on the podium and a 'Jugar de nuevo' button that sends new_game", async () => {
    const user = userEvent.setup();
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

    expect(screen.getByRole("heading", { name: "¡Ganaste!" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Jugar de nuevo" }));
    expect(send).toHaveBeenCalledWith({ type: "new_game" });
  });

  test("a non-host sees who won and a waiting message instead of the new-game button", () => {
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

    expect(screen.getByRole("heading", { name: "Ganó Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jugar de nuevo" })).not.toBeInTheDocument();
    expect(screen.getByText("Esperando que el anfitrión inicie otra partida")).toBeInTheDocument();
  });

  test("with 2 players the podium has only 2 places, the winner in the middle", () => {
    render(
      <RoundView
        room={makeRoom("result", {}, { score: { p1: 10, p2: 60 } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );
    const columns = within(screen.getByRole("list", { name: "Podio" })).getAllByRole("listitem");
    expect(columns.map(c => c.textContent)).toEqual(["A2.º Ana (vos)10 pts2", "B👑1.º Beto60 pts1"]);
  });
});
