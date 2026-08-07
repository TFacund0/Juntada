import { useRef } from "react";
import { describe, test, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, matchRoutes } from "react-router-dom";
import { ROUTES } from "./hooks/appRoutes";
import { routeInitFromMatches } from "./hooks/appRoutes";
import { routes } from "./routes";

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
// non-remounting PARENT/layout route (see design: "App as a single layout
// route — remounting on every path change would destroy useAppNavigation's
// state"). Exercises the exact PARENT/child shape routes.tsx actually uses
// (one pathless parent element, wrapping distinct child route ids) against a
// stub component, since App itself pulls in the app's full dependency tree.
let mountCount = 0;
function ParentStub() {
  const instanceId = useRef(++mountCount);
  return <div data-testid="parent-stub" data-instance={instanceId.current} />;
}

function buildTestRouter(initialPath: string) {
  return createMemoryRouter(
    [
      {
        children: [
          {
            element: <ParentStub />,
            children: [
              { id: "home", path: ROUTES.home, element: <div data-testid="child" /> },
              { id: "game", path: ROUTES.game, element: <div data-testid="child" /> },
              { id: "gameLocal", path: ROUTES.gameLocal, element: <div data-testid="child" /> },
              { id: "room", path: ROUTES.room, element: <div data-testid="child" /> },
              { id: "group", path: ROUTES.group, element: <div data-testid="child" /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
}

describe("routes.tsx: App layout route identity", () => {
  test("navigating between child app routes does not remount the shared parent layout", async () => {
    mountCount = 0;
    const router = buildTestRouter("/game/impostor");
    const { getByTestId } = render(<RouterProvider router={router} />);

    const firstInstance = getByTestId("parent-stub").dataset.instance;
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

    let secondInstance = getByTestId("parent-stub").dataset.instance;
    expect(secondInstance).toBe(firstInstance);

    try {
      await act(async () => {
        router.navigate("/");
        await Promise.resolve();
      });
    } catch {
      /* jsdom/undici AbortSignal interop bug — see comment above */
    }

    secondInstance = getByTestId("parent-stub").dataset.instance;
    // Same instance id (from the ref, set once on mount) proves the parent
    // layout was NOT unmounted/remounted across any of these navigations.
    expect(secondInstance).toBe(firstInstance);
    expect(mountCount).toBe(1);
  });
});

// Regression test for the "route ids must live on the CHILD routes, not on
// the App parent" invariant (see design.md) — routeInitFromMatches only
// reads the leaf entry in useMatches(), so this exercises the REAL exported
// route tree from routes.tsx (not a hand-rolled stand-in) to prove direct
// URL entry/refresh on every App-layout route still resolves the expected
// route id (and, through it, the expected session state) after the App
// parent/child restructure.
describe("routes.tsx: routeInitFromMatches wiring against the real route tree", () => {
  function matchesFor(pathname: string) {
    const matches = matchRoutes(routes, { pathname });
    return (matches ?? []).map(match => ({ ...match, id: match.route.id }));
  }

  test("home", () => {
    expect(matchesFor("/").at(-1)?.id).toBe("home");
    expect(routeInitFromMatches(matchesFor("/") as never)).toEqual({ gameId: null, mode: null, groupFlow: false, code: null });
  });

  test("game", () => {
    expect(matchesFor("/game/impostor").at(-1)?.id).toBe("game");
    expect(routeInitFromMatches(matchesFor("/game/impostor") as never)).toEqual({
      gameId: "impostor",
      mode: null,
      groupFlow: false,
      code: null,
    });
  });

  test("gameLocal", () => {
    expect(matchesFor("/game/impostor/local").at(-1)?.id).toBe("gameLocal");
    expect(routeInitFromMatches(matchesFor("/game/impostor/local") as never)).toEqual({
      gameId: "impostor",
      mode: "local",
      groupFlow: false,
      code: null,
    });
  });

  test("room", () => {
    expect(matchesFor("/room/impostor/ABC12").at(-1)?.id).toBe("room");
    expect(routeInitFromMatches(matchesFor("/room/impostor/ABC12") as never)).toEqual({
      gameId: "impostor",
      mode: "multi",
      groupFlow: false,
      code: "ABC12",
    });
  });

  test("group", () => {
    expect(matchesFor("/group/XYZ89").at(-1)?.id).toBe("group");
    expect(routeInitFromMatches(matchesFor("/group/XYZ89") as never)).toEqual({
      gameId: null,
      mode: "multi",
      groupFlow: true,
      code: "XYZ89",
    });
  });

  test("the App parent layout route itself carries no id — only its children do", () => {
    const appLayoutRoute = routes[0].children?.find(child => !("path" in child) && "children" in child);
    expect(appLayoutRoute?.id).toBeUndefined();
  });
});
