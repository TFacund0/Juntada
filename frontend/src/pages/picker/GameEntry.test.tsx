import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GameEntry } from "./GameEntry";
import type { AppOutletContext } from "./AppOutletContext";
import type { GameDef } from "../games/gameTypes";

const params = vi.fn<() => { gameId?: string }>();
const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useParams: () => params(), useOutletContext: () => outletContext() };
});

const getGame = vi.fn<(id: string) => GameDef | undefined>();
vi.mock("../games/registry", () => ({ getGame: (id: string) => getGame(id) }));

vi.mock("./LocalOnlyGamePage", () => ({
  LocalOnlyGamePage: () => <div data-testid="local-only-page" />,
}));
vi.mock("./ModePickerPage", () => ({
  ModePickerPage: () => <div data-testid="mode-picker-page" />,
}));

function fakeGame(overrides: Partial<GameDef> = {}): GameDef {
  return { id: "impostor", label: "Impostor", description: "", LocalGame: () => null, ...overrides };
}

describe("GameEntry", () => {
  test("renders LocalOnlyGamePage for a localOnly game — no URL change, just render dispatch", async () => {
    params.mockReturnValue({ gameId: "trivia" });
    getGame.mockReturnValue(fakeGame({ id: "trivia", localOnly: true }));
    render(<GameEntry />);
    expect(await screen.findByTestId("local-only-page")).toBeTruthy();
    expect(screen.queryByTestId("mode-picker-page")).toBeNull();
  });

  test("renders ModePickerPage for a non-localOnly game", async () => {
    params.mockReturnValue({ gameId: "impostor" });
    getGame.mockReturnValue(fakeGame({ id: "impostor", localOnly: false }));
    render(<GameEntry />);
    expect(await screen.findByTestId("mode-picker-page")).toBeTruthy();
    expect(screen.queryByTestId("local-only-page")).toBeNull();
  });

  test("renders ModePickerPage when gameId doesn't resolve to a known game", async () => {
    params.mockReturnValue({ gameId: "unknown" });
    getGame.mockReturnValue(undefined);
    render(<GameEntry />);
    expect(await screen.findByTestId("mode-picker-page")).toBeTruthy();
  });
});
