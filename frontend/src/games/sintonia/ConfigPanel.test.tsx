import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfigPanel } from "./ConfigPanel";

// Sintonía has no configurable options — this just confirms the
// explanatory placeholder renders instead of blank space.

describe("Sintonía ConfigPanel", () => {
  test("shows the 'no configuration' message", () => {
    render(<ConfigPanel />);
    expect(screen.getByText(/Sin configuración/)).toBeInTheDocument();
  });
});
