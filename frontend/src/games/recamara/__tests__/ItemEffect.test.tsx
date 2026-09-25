import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItemEffect } from "../components/ItemEffect";

describe("ItemEffect", () => {
  it("🪚 and 🚬 don't take over the screen — they play on the table (see SceneItemFx)", () => {
    expect(render(<ItemEffect fx={{ id: 1, kind: "item", item: "🪚" }} />).container).toBeEmptyDOMElement();
    expect(render(<ItemEffect fx={{ id: 2, kind: "item", item: "🚬", healed: true }} />).container).toBeEmptyDOMElement();
  });

  it("🔍 reveals the next shell to whoever used it", () => {
    const { container } = render(<ItemEffect fx={{ id: 1, kind: "item", item: "🔍", actorIsMe: true, revealedShellKind: "live" }} />);
    expect(container.querySelector(".lens-real.live")).toBeInTheDocument();
    expect(screen.getByText("Real")).toBeInTheDocument();
    expect(screen.getByText("Solo vos la viste")).toBeInTheDocument();
  });

  it("🔍 shows everyone else only a face-down shell and who looked", () => {
    const { container } = render(<ItemEffect fx={{ id: 1, kind: "item", item: "🔍", actorName: "Beto", revealedShellKind: null }} />);
    expect(container.querySelector(".lens-real")).toBeNull();
    expect(container.querySelector(".shell-icon.live, .shell-icon.blank")).toBeNull();
    expect(screen.getByText("Beto miró la próxima bala")).toBeInTheDocument();
    expect(screen.getByText("Vos no sabés qué vio")).toBeInTheDocument();
  });

  it("any other item keeps the plain icon pulse", () => {
    const { container } = render(<ItemEffect fx={{ id: 1, kind: "item", item: "🔒" }} />);
    expect(container.querySelector(".rec-modal-icon.activating")).toHaveTextContent("🔒");
  });

  it("announces itself to assistive tech", () => {
    render(<ItemEffect fx={{ id: 1, kind: "item", item: "🔍" }} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
