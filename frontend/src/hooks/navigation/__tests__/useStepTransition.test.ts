import { describe, test, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStepTransition } from "./useStepTransition";
import type { GameDef } from "../../games/gameTypes";

// Minimal stand-ins covering only the fields stepKey/isGameAvailable read —
// decoupled from the real registry so this doesn't depend on which games
// happen to be localOnly/available at any given time.
const localOnlyGame = { id: "local-only-game", localOnly: true, comingSoon: false, maintenance: false } as unknown as GameDef;
const dualModeGame = { id: "dual-mode-game", localOnly: false, comingSoon: false, maintenance: false } as unknown as GameDef;

describe("useStepTransition stepKey", () => {
  test("no game and no group flow is the picker step", () => {
    const { result } = renderHook(() => useStepTransition({ gameId: null, groupFlow: false, game: null, mode: null }));
    expect(result.current.stepKey).toBe("picker");
  });

  test("group flow with no game is the multi step", () => {
    const { result } = renderHook(() => useStepTransition({ gameId: null, groupFlow: true, game: null, mode: "multi" }));
    expect(result.current.stepKey).toBe("multi");
  });

  test("a local-only game with no mode chosen yet is a localonly step", () => {
    const { result } = renderHook(() => useStepTransition({ gameId: localOnlyGame.id, groupFlow: false, game: localOnlyGame, mode: null }));
    expect(result.current.stepKey).toBe(`localonly-${localOnlyGame.id}`);
  });

  test("a dual-mode game with no mode chosen yet is a modepicker step", () => {
    const { result } = renderHook(() => useStepTransition({ gameId: dualModeGame.id, groupFlow: false, game: dualModeGame, mode: null }));
    expect(result.current.stepKey).toBe(`modepicker-${dualModeGame.id}`);
  });

  test("local mode with a game chosen is a local step", () => {
    const { result } = renderHook(() =>
      useStepTransition({ gameId: dualModeGame.id, groupFlow: false, game: dualModeGame, mode: "local" }),
    );
    expect(result.current.stepKey).toBe(`local-${dualModeGame.id}`);
  });

  test("multi mode with a game chosen is the multi step", () => {
    const { result } = renderHook(() =>
      useStepTransition({ gameId: dualModeGame.id, groupFlow: false, game: dualModeGame, mode: "multi" }),
    );
    expect(result.current.stepKey).toBe("multi");
  });
});

describe("useStepTransition stepDirection", () => {
  test("starts forward and stays forward when moving to a deeper step", () => {
    const { result, rerender } = renderHook(
      ({ gameId, mode }: { gameId: string | null; mode: "local" | "multi" | null }) =>
        useStepTransition({ gameId, groupFlow: false, game: gameId ? dualModeGame : null, mode }),
      { initialProps: { gameId: null as string | null, mode: null as "local" | "multi" | null } },
    );
    expect(result.current.stepDirection).toBe("forward");
    rerender({ gameId: dualModeGame.id, mode: null });
    expect(result.current.stepDirection).toBe("forward");
  });

  test("moving back to the picker step reports back direction", () => {
    const { result, rerender } = renderHook(
      ({ gameId, mode }: { gameId: string | null; mode: "local" | "multi" | null }) =>
        useStepTransition({ gameId, groupFlow: false, game: gameId ? dualModeGame : null, mode }),
      { initialProps: { gameId: dualModeGame.id as string | null, mode: "local" as "local" | "multi" | null } },
    );
    expect(result.current.stepDirection).toBe("forward");
    rerender({ gameId: null, mode: null });
    expect(result.current.stepDirection).toBe("back");
  });
});

describe("useStepTransition curtain", () => {
  test("exposes the curtain state and controls from useCurtainTransition", () => {
    const { result } = renderHook(() => useStepTransition({ gameId: null, groupFlow: false, game: null, mode: null }));
    expect(result.current.curtain).toBe("none");
    expect(typeof result.current.withCurtain).toBe("function");
    expect(typeof result.current.withAsyncCurtain).toBe("function");
    expect(typeof result.current.settleAsyncCurtain).toBe("function");
  });
});
