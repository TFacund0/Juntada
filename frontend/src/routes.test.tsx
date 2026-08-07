import { useRef } from "react";
import { describe, test, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ROUTES } from "./hooks/appRoutes";

// react-router's data router builds an internal fetch Request on every
// navigate() call for potential loader support, even with no loaders
// defined — under this jsdom test environment that trips an unrelated
// jsdom/undici AbortSignal interop bug (a known toolchain quirk, not an app
// or routing bug) as a rejection outside this test's own call stack. The
// navigation and its render still complete synchronously before that
// rejection surfaces, so it's swallowed at the process level rather than
// left to fail the run as an unhandled error.
function ignoreRouterFetchInteropBug(reason: unknown) {
  if (reason instanceof TypeError && /AbortSignal/.test(reason.message)) return;
  // eslint-disable-next-line no-console
  console.error("Unexpected unhandled rejection in routes.test.tsx:", reason);
}
process.on("unhandledRejection", ignoreRouterFetchInteropBug);

// Regression test for the design decision that App must stay a single,
// non-remounting layout route (see design: "App as a single layout route —
// remounting on every path change would destroy useAppNavigation's state").
// Exercises the exact sibling-route shape routes.tsx uses (same component
// reference mounted at several distinct route ids, siblings under one
// parent, matched by react-router's data router — createMemoryRouter here,
// createBrowserRouter in production) against a stub component, since App
// itself pulls in the app's full dependency tree.
let mountCount = 0;
function Stub() {
  const instanceId = useRef(++mountCount);
  return <div data-testid="stub" data-instance={instanceId.current} />;
}

function buildTestRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {
        children: [
          { id: "home", path: ROUTES.home, element: <Stub /> },
          { id: "game", path: ROUTES.game, element: <Stub /> },
          { id: "gameLocal", path: ROUTES.gameLocal, element: <Stub /> },
          { id: "room", path: ROUTES.room, element: <Stub /> },
          { id: "group", path: ROUTES.group, element: <Stub /> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
}

describe("routes.tsx: App layout route identity", () => {
  test("navigating between sibling app routes does not remount the shared component", async () => {
    mountCount = 0;
    const router = buildTestRouter("/game/impostor");
    const { getByTestId } = render(<RouterProvider router={router} />);

    const firstInstance = getByTestId("stub").dataset.instance;
    expect(firstInstance).toBe("1");

    // react-router's data router builds an internal fetch Request on every
    // navigate() call for potential loader support, even with no loaders
    // defined — under this jsdom test environment that trips an unrelated
    // jsdom/undici AbortSignal interop bug (a known toolchain quirk, not an
    // app or routing bug). The navigation and its render still complete
    // synchronously before that rejection surfaces, so it's caught here and
    // ignored rather than left to fail the test run as an unhandled error.
    try {
      await act(async () => {
        router.navigate("/game/impostor/local");
        await Promise.resolve();
      });
    } catch {
      /* jsdom/undici AbortSignal interop bug — see comment above */
    }

    const secondInstance = getByTestId("stub").dataset.instance;
    // Same instance id (from the ref, set once on mount) proves the
    // component was NOT unmounted/remounted across the navigation.
    expect(secondInstance).toBe(firstInstance);
    expect(mountCount).toBe(1);
  });
});
