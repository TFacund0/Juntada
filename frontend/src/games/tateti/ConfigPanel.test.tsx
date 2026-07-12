import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfigPanel } from "./ConfigPanel";

describe("Ta-Te-Ti ConfigPanel", () => {
  test("shows the 'no configuration' message", () => {
    render(<ConfigPanel />);
    expect(screen.getByText(/Sin configuración/)).toBeInTheDocument();
  });
});
