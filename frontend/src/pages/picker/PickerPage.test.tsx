import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PickerPage } from "./PickerPage";
import type { AppOutletContext } from "./AppOutletContext";

const outletContext = vi.fn<() => Partial<AppOutletContext>>();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useOutletContext: () => outletContext() };
});

function baseContext(overrides: Partial<AppOutletContext> = {}): Partial<AppOutletContext> {
  return {
    gameId: null,
    groupFlow: false,
    GAME_LIST: [],
    pickGame: vi.fn(),
    ...overrides,
  };
}

describe("PickerPage", () => {
  test("renders the game picker when no game/group is chosen (guard met)", () => {
    outletContext.mockReturnValue(baseContext());
    const { container } = render(<PickerPage />);
    expect(container.querySelector("#jt-games")).not.toBeNull();
  });

  test("renders nothing when a game is already chosen — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ gameId: "impostor" }));
    const { container } = render(<PickerPage />);
    expect(container.firstChild).toBeNull();
  });

  test("renders nothing when a group flow is already active — one-render lag guard", () => {
    outletContext.mockReturnValue(baseContext({ groupFlow: true }));
    const { container } = render(<PickerPage />);
    expect(container.firstChild).toBeNull();
  });
});
