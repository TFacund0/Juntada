import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Palette } from "../palette/Palette";
import { DEFAULT_TOOL, type Tool } from "../../utils/palette";
import { RayadoSfxContext } from "../../hooks/rayadoSfxContext";
import type { RayadoSfx } from "../../hooks/useRayadoSfx";

function setup({ hasDrawing = true, initial = DEFAULT_TOOL }: { hasDrawing?: boolean; initial?: Tool } = {}) {
  const play = vi.fn();
  const onUndo = vi.fn();
  const onClear = vi.fn();
  const sfx: RayadoSfx = {
    muted: false,
    toggleMuted: vi.fn(),
    play,
    vibrate: vi.fn(),
    scribble: { start: vi.fn(), speed: vi.fn(), stop: vi.fn() },
  };
  let current = initial;
  function Harness() {
    const [tool, setTool] = useState(initial);
    current = tool;
    return (
      <RayadoSfxContext.Provider value={sfx}>
        <input aria-label="chat" />
        <Palette tool={tool} onToolChange={setTool} hasDrawing={hasDrawing} onUndo={onUndo} onClear={onClear} />
      </RayadoSfxContext.Provider>
    );
  }
  render(<Harness />);
  return { play, onUndo, onClear, tool: () => current };
}

afterEach(() => vi.useRealTimers());

describe("Rayado Libre palette", () => {
  test("colors, sizes and tools are radio groups with aria-checked and shortcut tooltips", () => {
    setup();
    const colors = screen.getByRole("radiogroup", { name: "Color" });
    expect(colors.querySelectorAll('[role="radio"]')).toHaveLength(9);
    const black = screen.getByRole("radio", { name: "Negro" });
    expect(black).toHaveAttribute("aria-checked", "true");
    expect(black).toHaveAttribute("title", "Negro (1)");
    expect(screen.getByRole("radio", { name: "Blanco" })).toHaveAttribute("title", "Blanco (9)");
    expect(screen.getByRole("radio", { name: "Grosor medio" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Grosor fino" })).toHaveAttribute("title", "Grosor fino ([ y ])");
    expect(screen.getByRole("radio", { name: "Lápiz" })).toHaveAttribute("title", "Lápiz (B)");
    expect(screen.getByRole("radio", { name: "Goma" })).toHaveAttribute("title", "Goma (E)");
    expect(screen.getByRole("radio", { name: "Balde" })).toHaveAttribute("title", "Balde (G)");
    expect(screen.getByRole("button", { name: "Deshacer" })).toHaveAttribute("title", "Deshacer (Ctrl+Z)");
  });

  test("tapping a color plays the cap sound and brings the eraser back to the pencil", async () => {
    const user = userEvent.setup();
    const { play, tool } = setup({ initial: { ...DEFAULT_TOOL, mode: "erase" } });
    await user.click(screen.getByRole("radio", { name: "Rojo" }));
    expect(tool()).toEqual({ ...DEFAULT_TOOL, color: "#e2432a", mode: "draw" });
    expect(play).toHaveBeenCalledWith("cap");
    expect(screen.getByRole("radio", { name: "Rojo" })).toHaveAttribute("aria-checked", "true");
  });

  test("a color keeps the bucket selected", async () => {
    const user = userEvent.setup();
    const { tool } = setup({ initial: { ...DEFAULT_TOOL, mode: "fill" } });
    await user.click(screen.getByRole("radio", { name: "Azul" }));
    expect(tool().mode).toBe("fill");
  });

  test("size and tool clicks play the click sound", async () => {
    const user = userEvent.setup();
    const { play, tool } = setup();
    await user.click(screen.getByRole("radio", { name: "Grosor grueso" }));
    await user.click(screen.getByRole("radio", { name: "Balde" }));
    expect(tool()).toMatchObject({ size: 20, mode: "fill" });
    expect(play).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenCalledWith("click");
  });

  test("undo is disabled with nothing on the board", () => {
    setup({ hasDrawing: false });
    expect(screen.getByRole("button", { name: "Deshacer" })).toBeDisabled();
  });

  test("undo plays the card sound", async () => {
    const user = userEvent.setup();
    const { play, onUndo } = setup();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("card");
  });

  test("clear asks for confirmation: the first tap arms '¿Borrar?', the second one clears", async () => {
    const user = userEvent.setup();
    const { onClear } = setup();
    await user.click(screen.getByRole("button", { name: "Borrar todo" }));
    expect(onClear).not.toHaveBeenCalled();
    const armed = screen.getByRole("button", { name: /¿Borrar\?/ });
    expect(armed).toHaveTextContent("¿Borrar?");
    await user.click(armed);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Borrar todo" })).not.toHaveTextContent("¿Borrar?");
  });

  test("the clear confirmation expires after 2.5 s", () => {
    vi.useFakeTimers();
    const { onClear } = setup();
    act(() => screen.getByRole("button", { name: "Borrar todo" }).click());
    expect(screen.getByRole("button", { name: /¿Borrar\?/ })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2500));
    act(() => screen.getByRole("button", { name: "Borrar todo" }).click());
    expect(onClear).not.toHaveBeenCalled();
  });

  test("clear does nothing on an empty board", async () => {
    const user = userEvent.setup();
    setup({ hasDrawing: false });
    await user.click(screen.getByRole("button", { name: "Borrar todo" }));
    expect(screen.queryByRole("button", { name: /¿Borrar\?/ })).not.toBeInTheDocument();
  });

  test("keyboard shortcuts drive the same actions", async () => {
    const user = userEvent.setup();
    const { tool, onUndo, play } = setup();
    await user.keyboard("2");
    expect(tool().color).toBe("#e2432a");
    await user.keyboard("e");
    expect(tool().mode).toBe("erase");
    await user.keyboard("]");
    expect(tool().size).toBe(20);
    // "[[" es cómo user-event escribe un "[" literal.
    await user.keyboard("[[[[");
    expect(tool().size).toBe(4);
    await user.keyboard("g");
    expect(tool().mode).toBe("fill");
    await user.keyboard("b");
    expect(tool().mode).toBe("draw");
    await user.keyboard("{Control>}z{/Control}");
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith("cap");
  });

  test("shortcuts are ignored while typing in an input", async () => {
    const user = userEvent.setup();
    const { tool } = setup();
    await user.click(screen.getByRole("textbox", { name: "chat" }));
    await user.keyboard("2e]");
    expect(tool()).toEqual(DEFAULT_TOOL);
  });
});
