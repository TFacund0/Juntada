import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PublicPlayer } from "@juntada/shared-types";
import { GuessChatPanel } from "../GuessChatPanel";
import type { ChatEntry } from "../../types/roundView";

function makePlayers(): PublicPlayer[] {
  return [
    { id: "p1", name: "Ana", ready: false, online: true, hasVoted: false },
    { id: "p2", name: "Beto", ready: false, online: true, hasVoted: false },
    { id: "p3", name: "Cami", ready: false, online: true, hasVoted: false },
  ];
}

describe("GuessChatPanel", () => {
  test("shows the guess input only when an input prop is passed (guesser role)", () => {
    const chatLog: ChatEntry[] = [];
    const { rerender } = render(
      <GuessChatPanel
        chatLog={chatLog}
        players={makePlayers()}
        correctGuessers={[]}
        roundPoints={{}}
        input={{ value: "", onChange: vi.fn(), onSubmit: vi.fn() }}
      />,
    );
    expect(screen.getByPlaceholderText("Tu respuesta...")).toBeInTheDocument();

    rerender(<GuessChatPanel chatLog={chatLog} players={makePlayers()} correctGuessers={[]} roundPoints={{}} />);
    expect(screen.queryByPlaceholderText("Tu respuesta...")).not.toBeInTheDocument();
  });

  test("the 'ya adivinó' header matches correctGuessers", () => {
    render(<GuessChatPanel chatLog={[]} players={makePlayers()} correctGuessers={["p2"]} roundPoints={{ p2: 80 }} />);
    expect(screen.getByText(/Beto/)).toBeInTheDocument();
    expect(screen.getByText(/\+80/)).toBeInTheDocument();
  });

  test("'correct' entries don't show up in the message feed — only regular chat text does", () => {
    const chatLog: ChatEntry[] = [
      { type: "chat", playerId: "p2", text: "¿es un perro?" },
      { type: "correct", playerId: "p2" },
    ];
    render(<GuessChatPanel chatLog={chatLog} players={makePlayers()} correctGuessers={["p2"]} roundPoints={{ p2: 80 }} />);

    expect(screen.getByText(/¿es un perro\?/)).toBeInTheDocument();
    expect(screen.queryByText(/Beto adivinó/)).not.toBeInTheDocument();
  });
});
