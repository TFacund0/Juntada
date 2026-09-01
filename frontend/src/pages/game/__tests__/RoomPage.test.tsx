import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoomPage } from "../RoomPage";
import type { MultiplayerGameProps } from "../../../features/multiplayer/MultiplayerGame";

interface EntryProps {
  mode: "local" | "multi" | null;
  gameId: string | null;
  groupFlow: boolean;
  props: Omit<MultiplayerGameProps, "entryKind">;
}

const entry = vi.fn<() => EntryProps>();
vi.mock("../../../hooks/navigation/useMultiplayerEntryProps", () => ({ useMultiplayerEntryProps: () => entry() }));

vi.mock("../../../features/multiplayer/MultiplayerGame", () => ({
  MultiplayerGame: (props: { entryKind: string; gameId: string | null }) => (
    <div data-testid="multiplayer-game" data-entry-kind={props.entryKind} data-game-id={props.gameId ?? ""} />
  ),
}));

function baseEntry(overrides: Partial<EntryProps> = {}): EntryProps {
  return {
    mode: "multi",
    gameId: "impostor",
    groupFlow: false,
    props: { gameId: "impostor" } as Omit<MultiplayerGameProps, "entryKind">,
    ...overrides,
  };
}

describe("RoomPage", () => {
  test("renders MultiplayerGame with entryKind room for a direct room entry (guard met)", async () => {
    entry.mockReturnValue(baseEntry());
    render(<RoomPage />);
    const el = await screen.findByTestId("multiplayer-game");
    expect(el.dataset.entryKind).toBe("room");
    expect(el.dataset.gameId).toBe("impostor");
  });

  test("renders nothing when mode is not multi — one-render lag guard", () => {
    entry.mockReturnValue(baseEntry({ mode: "local" }));
    const { container } = render(<RoomPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when there is no gameId — one-render lag guard", () => {
    entry.mockReturnValue(baseEntry({ gameId: null }));
    const { container } = render(<RoomPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when a group flow is active (belongs to GroupPage)", () => {
    entry.mockReturnValue(baseEntry({ groupFlow: true }));
    const { container } = render(<RoomPage />);
    expect(container.firstChild).toBeNull();
  });
});
