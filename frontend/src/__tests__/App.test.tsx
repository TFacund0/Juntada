import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import App from "../App";
import * as authContext from "../features/auth/context/AuthContext";

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

const authValue = (overrides: Partial<ReturnType<typeof authContext.useAuth>>) => ({
  user: null,
  accessToken: null,
  loading: false,
  justRegistered: false,
  clearJustRegistered: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  ...overrides,
});

describe("App", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("renders AuthScreen instead of the shell when there is no logged-in user", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue(authValue({ user: null }));

    renderApp();

    expect(screen.getByRole("button", { name: "Ingresar" })).toBeTruthy();
    expect(screen.queryByTestId("outlet-child")).toBeNull();
  });

  test("renders nothing while the boot-time silent refresh is still pending", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue(authValue({ user: null, loading: true }));

    const { container } = renderApp();

    expect(container.firstChild).toBeNull();
  });

  test("renders the shell and delegates to the routed outlet content when a user is logged in", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue(
      authValue({ user: { id: "u1", username: "Ana", email: "a@a.com", firstName: "Ana", lastName: "Lopez" } }),
    );

    renderApp();

    expect(screen.getByTestId("outlet-child")).toBeTruthy();
  });

  test("hook-order execution across a re-render does not throw (Rules-of-Hooks compliance)", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue(
      authValue({ user: { id: "u1", username: "Ana", email: "a@a.com", firstName: "Ana", lastName: "Lopez" } }),
    );

    const router = buildAppRouter();
    const { rerender } = render(<RouterProvider router={router} />);
    expect(() => rerender(<RouterProvider router={router} />)).not.toThrow();
  });
});
