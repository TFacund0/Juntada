import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useUrlSync } from "./useUrlSync";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateSpy };
});

// The checkpoint push (see useUrlSync's comment) exists so a stray browser
// "back" has a same-document entry to land on instead of leaving the app
// outright. It used to re-push a fresh entry every time midRound cycled
// false → true again (each round of a multi-round game), stacking one
// never-consumed history entry per round — a player needed one "back" tap
// per round played just to leave. This asserts it now pushes exactly once
// per mount no matter how many times midRound toggles.
function Harness({ midRound }: { midRound: boolean }) {
  useUrlSync("impostor", "multi", false, "ABCDE", null, midRound, () => {});
  return null;
}

describe("useUrlSync checkpoint push", () => {
  test("pushes the checkpoint entry only once across repeated midRound cycles", () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={["/room/impostor/ABCDE"]}>
        <Harness midRound={false} />
      </MemoryRouter>,
    );

    rerender(
      <MemoryRouter initialEntries={["/room/impostor/ABCDE"]}>
        <Harness midRound={true} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter initialEntries={["/room/impostor/ABCDE"]}>
        <Harness midRound={false} />
      </MemoryRouter>,
    );
    rerender(
      <MemoryRouter initialEntries={["/room/impostor/ABCDE"]}>
        <Harness midRound={true} />
      </MemoryRouter>,
    );

    const checkpointPushes = navigateSpy.mock.calls.filter(([, opts]) => opts?.replace === false);
    expect(checkpointPushes).toHaveLength(1);
  });
});
