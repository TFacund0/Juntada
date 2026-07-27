import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { RoundView } from "./RoundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
    { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
    { id: "p3", name: "Caro", ready: false, online: true, hasVoted: false },
  ];
}

function makeRoom(phase: string, roundOverrides: Record<string, unknown> = {}): RoomPublicState {
  return {
    code: "TEST1",
    name: "Sala de prueba",
    hostId: "p1",
    gameType: "quien-soy",
    phase,
    players: makePlayers(),
    maxPlayers: 8,
    groupCode: null,
    config: { score: {}, wordSource: "suggested", activeCategories: {}, turnOrder: [] },
    round: {
      wordSource: "suggested",
      submittedCount: 0,
      currentVoteTarget: null,
      voteSubmittedCount: null,
      voteEligibleCount: null,
      currentTurnPlayerId: "p1",
      turnOrder: ["p1", "p2", "p3"],
      lapNumber: 1,
      pendingQuestion: null,
      qaLog: [],
      guessLog: [],
      wrongGuesses: {},
      results: [],
      words: null,
      ...roundOverrides,
    },
    usedWords: {},
    roundHistory: [],
  };
}

describe("¿Quién Soy? RoundView — suggest phase", () => {
  test("submitting suggestions sends only the filled-in ones", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("suggest")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{
          mySuggestionSubmitted: false,
          wordsVisibleToMe: {},
          voteSuggestions: null,
          myVote: null,
          myWord: null,
          myWrongGuesses: 0,
        }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    const inputs = screen.getAllByPlaceholderText(/Ej: Messi/);
    await user.type(inputs[0], "Messi");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(send).toHaveBeenCalledWith({ type: "submit_suggestion", suggestions: { p2: "Messi" } });
  });

  test("already-submitted shows a waiting message instead of the form", () => {
    render(
      <RoundView
        room={makeRoom("suggest", { submittedCount: 1 })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ mySuggestionSubmitted: true, wordsVisibleToMe: {}, voteSuggestions: null, myVote: null, myWord: null, myWrongGuesses: 0 }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText("Enviaste tus sugerencias")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });
});

describe("¿Quién Soy? RoundView — vote phase", () => {
  test("voting for one of the suggested options sends its index", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("vote", { currentVoteTarget: "p2" })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{
          mySuggestionSubmitted: true,
          wordsVisibleToMe: {},
          voteSuggestions: ["Messi", "Batman"],
          myVote: null,
          myWord: null,
          myWrongGuesses: 0,
        }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByText("Batman"));
    expect(send).toHaveBeenCalledWith({ type: "vote_suggestion", suggestionIndex: 1 });
  });

  test("can't vote or see options on your own word", () => {
    render(
      <RoundView
        room={makeRoom("vote", { currentVoteTarget: "p1" })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{ mySuggestionSubmitted: true, wordsVisibleToMe: {}, voteSuggestions: null, myVote: null, myWord: null, myWrongGuesses: 0 }}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.getByText(/Es tu palabra/)).toBeInTheDocument();
  });
});

describe("¿Quién Soy? RoundView — assign phase", () => {
  test("shows the other players' words and, for the host, a button to start playing", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("assign")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={{
          mySuggestionSubmitted: true,
          wordsVisibleToMe: { p2: "Batman", p3: "Messi" },
          voteSuggestions: null,
          myVote: null,
          myWord: null,
          myWrongGuesses: 0,
        }}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Batman")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Empezar a preguntar" }));
    expect(send).toHaveBeenCalledWith({ type: "confirm_words_ready" });
  });

  test("a non-host sees a waiting message instead of the start button", () => {
    render(
      <RoundView
        room={makeRoom("assign")}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={{ mySuggestionSubmitted: true, wordsVisibleToMe: {}, voteSuggestions: null, myVote: null, myWord: null, myWrongGuesses: 0 }}
        wordReveal={null}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Empezar a preguntar" })).not.toBeInTheDocument();
    expect(screen.getByText("Esperando que el anfitrión arranque la ronda")).toBeInTheDocument();
  });
});

describe("¿Quién Soy? RoundView — playing phase", () => {
  const role = { mySuggestionSubmitted: true, wordsVisibleToMe: {}, voteSuggestions: null, myVote: null, myWord: null, myWrongGuesses: 0 };

  test("on my turn, asking a question sends ask_question", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("playing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={role}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Preguntar" }));
    await user.type(screen.getByPlaceholderText(/Soy famoso/), "¿Soy real?");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(send).toHaveBeenCalledWith({ type: "ask_question", text: "¿Soy real?" });
  });

  test("on my turn, guessing sends a 'guess' action", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("playing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={role}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Adivinar" }));
    await user.type(screen.getByPlaceholderText(/Escribí tu respuesta/), "Batman");
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(send).toHaveBeenCalledWith({ type: "guess", text: "Batman" });
  });

  test("conceding requires confirmation, then sends 'concede'", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("playing")}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={role}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    await user.click(screen.getByRole("button", { name: "🏳️" }));
    expect(screen.getByText("¿Rendirte?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Rendirme" }));
    expect(send).toHaveBeenCalledWith({ type: "concede" });
  });

  test("when it isn't my turn, no action buttons show up", () => {
    render(
      <RoundView
        room={makeRoom("playing", { currentTurnPlayerId: "p2" })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={role}
        wordReveal={null}
        isHost={true}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Preguntar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adivinar" })).not.toBeInTheDocument();
  });

  test("a pending question from another player shows sí/no/paso to answer", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("playing", { pendingQuestion: { by: "p2", text: "¿Soy real?", responses: {} } })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={role}
        wordReveal={null}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText('"¿Soy real?"')).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sí" }));
    expect(send).toHaveBeenCalledWith({ type: "answer_question", answer: "si", comment: undefined });
  });
});

describe("¿Quién Soy? RoundView — result phase", () => {
  test("shows the standings, and lets the host start a new game", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    render(
      <RoundView
        room={makeRoom("result", {
          results: [{ playerId: "p1", outcome: "solved", lap: 1 }],
          words: { p1: "Messi", p2: "Batman", p3: "Superman" },
        })}
        me={{ playerId: "p1", roomCode: "TEST1" }}
        myPlayer={makePlayers()[0]}
        myRole={null}
        wordReveal={{ words: { p1: "Messi", p2: "Batman", p3: "Superman" } }}
        isHost={true}
        send={send}
      />,
    );

    expect(screen.getByText("Ana")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nueva partida" }));
    expect(send).toHaveBeenCalledWith({ type: "new_game" });
  });

  test("a non-host sees a waiting message instead of the new-game button", () => {
    render(
      <RoundView
        room={makeRoom("result", { results: [] })}
        me={{ playerId: "p2", roomCode: "TEST1" }}
        myPlayer={makePlayers()[1]}
        myRole={null}
        wordReveal={{ words: {} }}
        isHost={false}
        send={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Nueva partida" })).not.toBeInTheDocument();
    expect(screen.getByText("Esperando que el anfitrión inicie otra partida")).toBeInTheDocument();
  });
});
