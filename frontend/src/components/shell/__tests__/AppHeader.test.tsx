import { describe, test, expect } from "vitest";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { AppHeader } from "../AppHeader";
import type { GameDef } from "../../../games/gameTypes";

const baseProps = {
  mode: null as "local" | "multi" | null,
  groupFlow: false,
  groupAttached: false,
  game: null as GameDef | null | undefined,
  accentColor: "#7f77dd",
  mutedColor: "#999",
  playerName: "Ana",
  onSavePlayerName: () => {},
  onBack: () => {},
  onExit: () => {},
  showProfileMenu: false,
  onToggleProfileMenu: () => {},
  profileMenuRef: createRef<HTMLDivElement>(),
  onStartGroupFlow: () => {},
  showRules: false,
  onToggleRules: () => {},
};

describe("AppHeader", () => {
  test("renders HomeNavbar when there is no gameId and no groupFlow", () => {
    const { container } = render(<AppHeader {...baseProps} gameId={null} groupFlow={false} />);
    expect(container.querySelector(".jt-home-navbar")).not.toBeNull();
    expect(container.querySelector(".jt-ingame-logo")).toBeNull();
  });

  test("renders GameNavbar when gameId is set", () => {
    const { container } = render(<AppHeader {...baseProps} gameId="impostor" groupFlow={false} />);
    expect(container.querySelector(".jt-ingame-logo")).not.toBeNull();
    expect(container.querySelector(".jt-home-navbar")).toBeNull();
  });

  test("stays on HomeNavbar while groupFlow is true but not yet attached (create/join modal still showing)", () => {
    const { container } = render(<AppHeader {...baseProps} gameId={null} groupFlow={true} groupAttached={false} />);
    expect(container.querySelector(".jt-home-navbar")).not.toBeNull();
    expect(container.querySelector(".jt-ingame-logo")).toBeNull();
  });

  test("renders GameNavbar once groupFlow is true and the group is actually attached", () => {
    const { container } = render(<AppHeader {...baseProps} gameId={null} groupFlow={true} groupAttached={true} />);
    expect(container.querySelector(".jt-ingame-logo")).not.toBeNull();
    expect(container.querySelector(".jt-home-navbar")).toBeNull();
  });
});
