import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutcomeBanner } from "../components/OutcomeBanner";

describe("OutcomeBanner", () => {
  it("renders regular shot banner without elimination callout", () => {
    render(
      <OutcomeBanner
        line={{ text: "<b>Facu</b> le dispara a <b>Nico</b>." }}
        subLine={{ text: "Cartucho real — pierde vida", cls: "danger" }}
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText(/le dispara a/i)).toBeDefined();
    expect(screen.queryByText(/ELIMINADO/i)).toBeNull();
  });

  it("renders dramatic elimination callout when isElimination is true", () => {
    render(
      <OutcomeBanner
        line={{ text: "<b>Facu</b> le dispara a <b>Nico</b>." }}
        subLine={{ text: "Cartucho real — pierde vida", cls: "danger" }}
        isElimination={true}
        eliminatedName="Nico"
        onContinue={vi.fn()}
      />,
    );

    expect(screen.getByText(/¡Nico ELIMINADO!/i)).toBeDefined();
    expect(screen.getByText("💀")).toBeDefined();
  });
});
