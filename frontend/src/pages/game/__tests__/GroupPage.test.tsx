import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GroupPage } from "../GroupPage";
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
    gameId: null,
    groupFlow: true,
    props: { gameId: null } as Omit<MultiplayerGameProps, "entryKind">,
    ...overrides,
  };
}

describe("GroupPage", () => {
  test("renders MultiplayerGame with entryKind group for an active group flow (guard met)", async () => {
    entry.mockReturnValue(baseEntry());
    render(<GroupPage />);
    const el = await screen.findByTestId("multiplayer-game");
    expect(el.dataset.entryKind).toBe("group");
  });

  test("renders MultiplayerGame with entryKind group even with a gameId set (group instance running one)", async () => {
    entry.mockReturnValue(baseEntry({ gameId: "impostor", props: { gameId: "impostor" } as Omit<MultiplayerGameProps, "entryKind"> }));
    render(<GroupPage />);
    const el = await screen.findByTestId("multiplayer-game");
    expect(el.dataset.entryKind).toBe("group");
    expect(el.dataset.gameId).toBe("impostor");
  });

  test("renders nothing when mode is not multi — one-render lag guard", () => {
    entry.mockReturnValue(baseEntry({ mode: null }));
    const { container } = render(<GroupPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when there is no group flow — one-render lag guard", () => {
    entry.mockReturnValue(baseEntry({ groupFlow: false, gameId: "impostor" }));
    const { container } = render(<GroupPage />);
    expect(container.firstChild).toBeNull();
  });
});
