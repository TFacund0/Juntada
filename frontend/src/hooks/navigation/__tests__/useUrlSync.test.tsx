import { useState, useEffect } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { useUrlSync } from "../useUrlSync";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

// useBlocker throws when used outside a data router, so these tests need
// createMemoryRouter (not the old plain <MemoryRouter>) even though
// navigate itself is mocked above.
function Harness({ midRound, goBack }: { midRound: boolean; goBack: () => void }) {
  useUrlSync("impostor", "multi", false, "ABCDE", null, midRound, goBack);
  return null;
}

function renderHarness(midRound: boolean, goBack: () => void) {
  const router = createMemoryRouter([{ path: "/room/:gameId/:code", element: <Harness midRound={midRound} goBack={goBack} /> }], {
    initialEntries: ["/room/impostor/ABCDE"],
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

describe("useUrlSync checkpoint push", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  // The checkpoint push (see useUrlSync's comment) exists so a stray browser
  // "back" has a same-document entry to land on instead of leaving the app
  // outright. It used to re-push a fresh entry every time midRound cycled
  // false → true again (each round of a multi-round game), stacking one
  // never-consumed history entry per round — a player needed one "back" tap
  // per round played just to leave. This asserts it now pushes exactly once
  // per mount no matter how many times midRound toggles.
  test("pushes the checkpoint entry only once across repeated midRound cycles", () => {
    const goBack = () => {};
    const router = createMemoryRouter(
      [
        {
          path: "/room/:gameId/:code",
          element: <RerenderHarness goBack={goBack} />,
        },
      ],
      { initialEntries: ["/room/impostor/ABCDE"] },
    );
    render(<RouterProvider router={router} />);

    const checkpointPushes = () => navigateSpy.mock.calls.filter(([, opts]) => opts?.replace === false);
    // RerenderHarness below drives midRound through false→true→false→true.
    return waitFor(() => expect(checkpointPushes()).toHaveLength(1));
  });
});

describe("useUrlSync blocked navigation", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  test("a blocked POP while midRound is true runs goBack and blocker.reset() restores the location", async () => {
    const goBack = vi.fn();
    const { router } = renderHarness(true, goBack);

    // Simulate the checkpoint being consumed by a browser "back": go back
    // one entry in the in-memory history the same way a real POP would.
    router.navigate(-1);

    await waitFor(() => expect(goBack).toHaveBeenCalledTimes(1));
    // blocker.reset() restores the location it was blocking at — the router
    // should still be sitting on the checkpointed room path, not wherever
    // the POP would otherwise have landed.
    expect(router.state.location.pathname).toBe("/room/impostor/ABCDE");
  });
});

// Drives midRound through false → true → false → true across rerenders, the
// same sequence the old test exercised via <MemoryRouter> rerender().
function RerenderHarness({ goBack }: { goBack: () => void }) {
  const sequence = [false, true, false, true];
  return <MidRoundCycler sequence={sequence} goBack={goBack} />;
}

function MidRoundCycler({ sequence, goBack }: { sequence: boolean[]; goBack: () => void }) {
  // A tiny local cycler so this stays a single render tree the data router
  // can mount once, rather than needing repeated <RouterProvider> remounts.
  // Each mount step calls useUrlSync with the next value in `sequence`.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step < sequence.length - 1) setStep(s => s + 1);
  }, [step, sequence.length]);
  return <Harness midRound={sequence[step]} goBack={goBack} />;
}
