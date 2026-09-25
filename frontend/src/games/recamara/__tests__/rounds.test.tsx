import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { itemBannerTitle, shotBanner } from "../utils/banners";
import { ResultBanner } from "../components/ResultBanner";
import { RoundOverlay } from "../components/RoundOverlay";
import { EndScreen } from "../components/EndScreen";
import { BANNER_AUTO_MS, BANNER_TAP_GUARD_MS } from "../utils/timing";

const base = {
  shellKind: "live" as const,
  damage: 1,
  shooterName: "Lucía",
  shooterIsMe: false,
  targetName: "Tomi",
  targetIsMe: false,
  selfShot: false,
  eliminated: false,
};

describe("shotBanner", () => {
  it("live: REAL and who loses how many lives, and whether they're out", () => {
    expect(shotBanner(base)).toEqual({ tone: "live", big: "REAL", sub: "Tomi pierde 1 vida" });
    expect(shotBanner({ ...base, damage: 2, eliminated: true }).sub).toBe("Tomi pierde 2 vidas y queda afuera");
    expect(shotBanner({ ...base, targetIsMe: true, eliminated: true }).sub).toBe("Perdés 1 vida y quedás afuera");
  });

  it("blank: FALSA, and whether the shooter keeps the turn", () => {
    expect(shotBanner({ ...base, shellKind: "blank" })).toEqual({ tone: "blank", big: "FALSA", sub: "No pasó nada" });
    expect(shotBanner({ ...base, shellKind: "blank", selfShot: true }).sub).toBe("Lucía sigue tirando");
    expect(shotBanner({ ...base, shellKind: "blank", selfShot: true, shooterIsMe: true }).sub).toBe("Seguís tirando vos");
  });

  it("item titles: the saw's own headline, everything else its short name", () => {
    expect(itemBannerTitle("🪚")).toBe("CAÑO RECORTADO");
    expect(itemBannerTitle("🔍")).toBe("LUPA");
  });
});

describe("ResultBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderBanner = (onContinue = vi.fn()) => {
    render(
      <ResultBanner
        tone="live"
        big="REAL"
        sub="Tomi pierde 1 vida"
        whoHtml="<b>Lucía</b> le dispara a <b>Tomi</b>."
        onContinue={onContinue}
      />,
    );
    return onContinue;
  };

  it("shows the verdict over the table, without a modal", () => {
    renderBanner();
    expect(screen.getByText("REAL")).toHaveClass("result-banner-big", "live");
    expect(screen.getByText("Tomi pierde 1 vida")).toBeInTheDocument();
    expect(document.querySelector(".rec-overlay")).toBeNull();
  });

  it("a tap anywhere moves on — but not the tap that fired, inside the guard", () => {
    const onContinue = renderBanner();
    fireEvent.pointerDown(window);
    expect(onContinue).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(BANNER_TAP_GUARD_MS));
    fireEvent.pointerDown(document.body);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("moves on by itself after BANNER_AUTO_MS", () => {
    const onContinue = renderBanner();
    act(() => vi.advanceTimersByTime(BANNER_AUTO_MS - 1));
    expect(onContinue).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("the button (pointerdown + click), a key and the timer together still only move on once", () => {
    const onContinue = renderBanner();
    act(() => vi.advanceTimersByTime(BANNER_TAP_GUARD_MS));
    const button = screen.getByRole("button", { name: "Continuar" });
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    fireEvent.keyDown(window, { key: "Enter" });
    act(() => vi.advanceTimersByTime(BANNER_AUTO_MS));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("plain-text sub lines are never parsed as markup", () => {
    render(<ResultBanner tone="blank" big="FALSA" sub="<img src=x onerror=alert(1)> sigue tirando" onContinue={vi.fn()} />);
    expect(document.querySelector(".result-banner-sub img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)> sigue tirando")).toBeInTheDocument();
  });
});

describe("RoundOverlay", () => {
  it("titles the round, runs the reload and reports done once it has lifted", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const onDone = vi.fn();
    render(<RoundOverlay roundNumber={3} liveCount={2} blankCount={1} onDone={onDone} />);
    expect(screen.getByRole("status", { name: "Ronda 3" })).toBeInTheDocument();
    expect(screen.getByText("Ronda 3")).toHaveClass("round-overlay-title");
    act(() => vi.advanceTimersByTime(20000));
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe("EndScreen", () => {
  it("shows who won and focuses the first action", () => {
    render(
      <EndScreen title="Ganaste" sub="Última persona en la mesa.">
        <button>Volver a la sala</button>
      </EndScreen>,
    );
    expect(screen.getByRole("dialog", { name: "Ganaste" })).toBeInTheDocument();
    expect(screen.getByText("Última persona en la mesa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a la sala" })).toHaveFocus();
  });
});
