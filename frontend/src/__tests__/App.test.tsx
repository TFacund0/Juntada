import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import App from "../App";
import * as playerNameHook from "../hooks/session/usePlayerName";

// App must stay a single, non-remounting PARENT/layout route (design.md) and
// useAppSession needs real useMatches, which only works under a real data
// router (createMemoryRouter/RouterProvider) — same shape as
// src/__tests__/routes.test.tsx, not a plain <MemoryRouter>.
function buildAppRouter() {
  return createMemoryRouter(
    [
      {
        element: <App />,
        children: [{ index: true, element: <div data-testid="outlet-child" /> }],
      },
    ],
    { initialEntries: ["/"] },
  );
}

function renderApp() {
  return render(<RouterProvider router={buildAppRouter()} />);
}

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("renders NameOnboardingScreen instead of the shell when playerName is empty", () => {
    vi.spyOn(playerNameHook, "usePlayerName").mockReturnValue({ playerName: "", savePlayerName: vi.fn() });

    renderApp();

    expect(screen.getByRole("button", { name: /guardar|continuar|listo/i })).toBeTruthy();
    expect(screen.queryByTestId("outlet-child")).toBeNull();
  });

  test("renders the shell and delegates to the routed outlet content when playerName is set", () => {
    vi.spyOn(playerNameHook, "usePlayerName").mockReturnValue({ playerName: "Ana", savePlayerName: vi.fn() });

    renderApp();

    expect(screen.getByTestId("outlet-child")).toBeTruthy();
  });

  test("hook-order execution across a re-render does not throw (Rules-of-Hooks compliance)", () => {
    vi.spyOn(playerNameHook, "usePlayerName").mockReturnValue({ playerName: "Ana", savePlayerName: vi.fn() });

    const router = buildAppRouter();
    const { rerender } = render(<RouterProvider router={router} />);
    expect(() => rerender(<RouterProvider router={router} />)).not.toThrow();
  });
});
