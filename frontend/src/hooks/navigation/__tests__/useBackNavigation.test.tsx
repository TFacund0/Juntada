import { describe, test, expect, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { useBackNavigation } from "../useBackNavigation";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

type Args = Parameters<typeof useBackNavigation>[0];

function baseArgs(overrides: Partial<Args> = {}): Args {
  return {
    gameId: null,
    mode: null,
    groupFlow: false,
    roomCode: null,
    groupCode: null,
    groupAttached: false,
    roomPhase: null,
    inRoom: false,
    returnToGroupRef: { current: vi.fn() },
    localGameMidMatchRef: { current: vi.fn(() => false) },
    setMode: vi.fn(),
    setRoomCode: vi.fn(),
    setGameId: vi.fn(),
    setShowRules: vi.fn(),
    setShowExitConfirm: vi.fn(),
    setShowBackConfirm: vi.fn(),
    setShowLocalResetConfirm: vi.fn(),
    setShowReturnToGroupConfirm: vi.fn(),
    ...overrides,
  };
}

// useBlocker (called internally via useUrlSync) throws outside a data
// router, so every render here needs createMemoryRouter — same pattern as
// useUrlSync.test.tsx.
function renderBackNavigation(args: Args) {
  const holder: { current: ReturnType<typeof useBackNavigation> | null } = { current: null };
  function Harness() {
    holder.current = useBackNavigation(args);
    return null;
  }
  const router = createMemoryRouter([{ path: "/", element: <Harness /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
  return holder;
}

describe("useBackNavigation midRound", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  // Verbatim copy of useAppNavigation.ts's midRound expression — do not
  // simplify. Combines 4 distinct concerns: groupAttached, gameId/
  // roomHasProgress, mode, inRoom.
  test("groupAttached with a gameId reads roomHasProgress(roomPhase)", () => {
    const holder = renderBackNavigation(baseArgs({ groupAttached: true, gameId: "impostor", roomPhase: "round" }));
    expect(holder.current?.midRound).toBe(true);
  });

  test("groupAttached with a gameId and lobby phase is not mid-round", () => {
    const holder = renderBackNavigation(baseArgs({ groupAttached: true, gameId: "impostor", roomPhase: "lobby" }));
    expect(holder.current?.midRound).toBe(false);
  });

  test("groupAttached with no gameId (sitting on the group screen) is always mid-round", () => {
    const holder = renderBackNavigation(baseArgs({ groupAttached: true, gameId: null }));
    expect(holder.current?.midRound).toBe(true);
  });

  test("not groupAttached: local mode is mid-round", () => {
    const holder = renderBackNavigation(baseArgs({ mode: "local" }));
    expect(holder.current?.midRound).toBe(true);
  });

  test("not groupAttached: multi mode while in a room is mid-round", () => {
    const holder = renderBackNavigation(baseArgs({ mode: "multi", inRoom: true }));
    expect(holder.current?.midRound).toBe(true);
  });

  test("not groupAttached: multi mode not yet in a room is not mid-round", () => {
    const holder = renderBackNavigation(baseArgs({ mode: "multi", inRoom: false }));
    expect(holder.current?.midRound).toBe(false);
  });

  test("no mode chosen is not mid-round", () => {
    const holder = renderBackNavigation(baseArgs({ mode: null }));
    expect(holder.current?.midRound).toBe(false);
  });
});

describe("useBackNavigation goBack", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  test("groupAttached + gameId + progress asks to confirm returning to the group", () => {
    const args = baseArgs({ groupAttached: true, gameId: "impostor", roomPhase: "round" });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setShowReturnToGroupConfirm).toHaveBeenCalledWith(true);
    expect(args.returnToGroupRef.current).not.toHaveBeenCalled();
  });

  test("groupAttached + gameId + no progress returns to the group immediately", () => {
    const args = baseArgs({ groupAttached: true, gameId: "impostor", roomPhase: "lobby" });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.returnToGroupRef.current).toHaveBeenCalledTimes(1);
    expect(args.setShowReturnToGroupConfirm).not.toHaveBeenCalled();
  });

  test("groupAttached + no gameId asks to confirm exiting the group", () => {
    const args = baseArgs({ groupAttached: true, gameId: null });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setShowExitConfirm).toHaveBeenCalledWith(true);
  });

  test("local mode mid-match asks to confirm the local reset", () => {
    const args = baseArgs({ mode: "local", localGameMidMatchRef: { current: () => true } });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setShowLocalResetConfirm).toHaveBeenCalledWith(true);
  });

  test("local mode not mid-match asks to confirm the back-out", () => {
    const args = baseArgs({ mode: "local", localGameMidMatchRef: { current: () => false } });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setShowBackConfirm).toHaveBeenCalledWith(true);
  });

  test("multi mode already in a room asks to confirm the back-out", () => {
    const args = baseArgs({ mode: "multi", inRoom: true });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setShowBackConfirm).toHaveBeenCalledWith(true);
  });

  test("multi mode not yet in a room goes straight back to mode picker, no confirm", () => {
    const args = baseArgs({ mode: "multi", inRoom: false });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setMode).toHaveBeenCalledWith(null);
    expect(args.setRoomCode).toHaveBeenCalledWith(null);
    expect(args.setShowBackConfirm).not.toHaveBeenCalled();
  });

  test("no mode chosen clears gameId and rules, no confirm", () => {
    const args = baseArgs({ mode: null, gameId: "impostor" });
    const holder = renderBackNavigation(args);
    act(() => holder.current?.goBack());
    expect(args.setGameId).toHaveBeenCalledWith(null);
    expect(args.setShowRules).toHaveBeenCalledWith(false);
  });
});
