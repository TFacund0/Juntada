import { describe, test, expect, vi, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AppErrorBoundary } from "./AppErrorBoundary";

function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  test("renders children when no error is thrown", () => {
    const { getByText } = render(
      <AppErrorBoundary>
        <div>all good</div>
      </AppErrorBoundary>,
    );
    expect(getByText("all good")).not.toBeNull();
  });

  test("renders the fallback UI when a child throws, and logs via console.error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getByText } = render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(getByText("Algo salió mal")).not.toBeNull();
    expect(getByText("Se rompió algo de nuestro lado. Probá recargar la página.")).not.toBeNull();
    expect(getByText("Recargar")).not.toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  test('clicking "Recargar" calls window.location.reload', () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    const { getByText } = render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    fireEvent.click(getByText("Recargar"));
    expect(reload).toHaveBeenCalled();

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  // RED-guard: proves GameLoadErrorBoundary's chunk-404 auto-reload behavior
  // was NOT copied into the root boundary — a chunk-load-style error must
  // never trigger an automatic reload here.
  test("does NOT auto-reload for a chunk-load-style error message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    render(
      <AppErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module" />
      </AppErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});
