import { describe, test, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { DialogFrame } from "../DialogFrame";

// jsdom nunca calcula layout, así que `offsetParent` es siempre `null` — el
// filtro real de DialogFrame lo usa para descartar nodos ocultos, así que acá
// se lo reemplaza por un stub basado en `parentElement` para que el mismo
// filtro no descarte todo en el entorno de test.
Object.defineProperty(HTMLElement.prototype, "offsetParent", {
  configurable: true,
  get() {
    return this.parentElement;
  },
});

afterEach(() => {
  cleanup();
});

function getCard(): HTMLElement {
  const card = document.querySelector(".jt-dialog-card");
  if (!card) throw new Error("card not found");
  return card as HTMLElement;
}

describe("DialogFrame", () => {
  describe("role/aria", () => {
    test("default role is dialog with aria-modal true", () => {
      render(
        <DialogFrame onClose={vi.fn()}>
          <button>ok</button>
        </DialogFrame>,
      );
      const card = getCard();
      expect(card.getAttribute("role")).toBe("dialog");
      expect(card.getAttribute("aria-modal")).toBe("true");
    });

    test("role=alertdialog opt-in", () => {
      render(
        <DialogFrame onClose={vi.fn()} role="alertdialog">
          <button>ok</button>
        </DialogFrame>,
      );
      expect(getCard().getAttribute("role")).toBe("alertdialog");
    });

    test("aria-labelledby resolves to passed titleId", () => {
      render(
        <DialogFrame onClose={vi.fn()} titleId="my-title">
          <p id="my-title">Title</p>
        </DialogFrame>,
      );
      expect(getCard().getAttribute("aria-labelledby")).toBe("my-title");
    });
  });

  describe("Escape gating", () => {
    test("Escape calls onClose by default", () => {
      const onClose = vi.fn();
      render(
        <DialogFrame onClose={onClose}>
          <button>ok</button>
        </DialogFrame>,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test("closeOnEscape={false} suppresses Escape", () => {
      const onClose = vi.fn();
      render(
        <DialogFrame onClose={onClose} closeOnEscape={false}>
          <button>ok</button>
        </DialogFrame>,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();
    });

    test("Escape still fires with closeOnOverlayClick={false}", () => {
      const onClose = vi.fn();
      render(
        <DialogFrame onClose={onClose} closeOnOverlayClick={false}>
          <button>ok</button>
        </DialogFrame>,
      );
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("initial focus", () => {
    test("first focusable child gets focus on mount", () => {
      render(
        <DialogFrame onClose={vi.fn()}>
          <button>first</button>
          <button>second</button>
        </DialogFrame>,
      );
      expect(document.activeElement?.textContent).toBe("first");
    });

    test("card itself gets focus when no focusable descendant exists", () => {
      render(
        <DialogFrame onClose={vi.fn()}>
          <p>no focusables here</p>
        </DialogFrame>,
      );
      const card = getCard();
      expect(document.activeElement).toBe(card);
      expect(card.getAttribute("tabindex")).toBe("-1");
    });
  });

  describe("Tab wrap", () => {
    test("Tab from last focusable wraps to first", () => {
      render(
        <DialogFrame onClose={vi.fn()}>
          <button>first</button>
          <button>second</button>
        </DialogFrame>,
      );
      const card = getCard();
      const buttons = card.querySelectorAll("button");
      (buttons[1] as HTMLElement).focus();
      fireEvent.keyDown(document, { key: "Tab" });
      expect(document.activeElement).toBe(buttons[0]);
    });

    test("Shift+Tab from first wraps to last", () => {
      render(
        <DialogFrame onClose={vi.fn()}>
          <button>first</button>
          <button>second</button>
        </DialogFrame>,
      );
      const card = getCard();
      const buttons = card.querySelectorAll("button");
      (buttons[0] as HTMLElement).focus();
      fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
      expect(document.activeElement).toBe(buttons[1]);
    });
  });

  describe("focus restoration", () => {
    test("focus returns to trigger element after unmount", () => {
      const trigger = document.createElement("button");
      trigger.textContent = "trigger";
      document.body.appendChild(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      const { unmount } = render(
        <DialogFrame onClose={vi.fn()}>
          <button>inside</button>
        </DialogFrame>,
      );
      expect(document.activeElement).not.toBe(trigger);

      unmount();
      expect(document.activeElement).toBe(trigger);

      trigger.remove();
    });
  });
});
