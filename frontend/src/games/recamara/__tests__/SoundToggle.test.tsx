import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SoundToggle } from "../components/SoundToggle";

describe("SoundToggle", () => {
  it("announces its state and calls onToggle", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<SoundToggle muted={false} onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: "Silenciar sonido" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.setup().click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(<SoundToggle muted={true} onToggle={onToggle} />);
    expect(screen.getByRole("button", { name: "Activar sonido" })).toHaveAttribute("aria-pressed", "true");
  });
});
