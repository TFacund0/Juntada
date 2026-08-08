import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { JoinRedirect } from "./JoinRedirect";
import type { JoinLink } from "./utils/joinLink";

// Landing spot standing in for App.tsx (mounted at "/") — surfaces whatever
// router state JoinRedirect handed it off as plain text, so the assertions
// below don't need to know anything about App's own rendering.
function LocationProbe() {
  const location = useLocation();
  const joinLink = (location.state as { joinLink?: JoinLink } | null)?.joinLink ?? null;
  return <div data-testid="probe">{JSON.stringify(joinLink)}</div>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/join/:code" element={<JoinRedirect />} />
        <Route path="/" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("JoinRedirect", () => {
  test("redirects a group link to / with the parsed join link as router state", () => {
    renderAt("/join/abc12?kind=group");
    expect(JSON.parse(screen.getByTestId("probe").textContent!)).toEqual({ code: "ABC12", kind: "group" });
  });

  test("redirects a room link to / with the parsed join link as router state", () => {
    renderAt("/join/xyz89?game=impostor");
    expect(JSON.parse(screen.getByTestId("probe").textContent!)).toEqual({ code: "XYZ89", kind: "room", gameId: "impostor" });
  });
});
