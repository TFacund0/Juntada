import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { highlightShellHints, itemBannerTitle, shotBanner } from "../utils/banners";
import { ResultBanner } from "../components/ResultBanner";
import { RoundOverlay } from "../components/RoundOverlay";
import { EndScreen } from "../components/EndScreen";
import { EliminationBanner } from "../components/EliminationBanner";
import { BANNER_AUTO_MS, BANNER_TAP_GUARD_MS, ELIMINATION_AUTO_MS } from "../utils/timing";

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

describe("highlightShellHints", () => {
  it("colors what the 🔍/📞 revealed — real red, falsa yellow — and chips the position", () => {
    const lupa = highlightShellHints("<b>Ana</b> usa la lupa: la próxima bala es <b>real</b>.");
    expect(lupa).toContain('<b class="text-rec-live-glow uppercase">real</b>');
    const phone = highlightShellHints(
      "<b>Ana</b> recibe una pista por teléfono: la bala en la posición <b>3</b> del cargador es <b>falsa</b>.",
    );
    expect(phone).toContain('<b class="text-rec-gold uppercase">falsa</b>');
    expect(phone).toContain('posición <b class="rounded bg-white/15 px-1.5 text-rec-ink">3</b>');
  });

  it("never recolors a player who happens to be named like a shell", () => {
    const html = "<b>real</b> le roba 🔍 a <b>falsa</b>.";
    expect(highlightShellHints(html)).toBe(html);
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
  it("my own win: ¡Ganaste! with the trophy, and focus on the first action", () => {
    render(
      <EndScreen winnerName="Ana" isMe sub="Última persona en la mesa.">
        <button>Volver a la sala</button>
      </EndScreen>,
    );
    expect(screen.getByRole("dialog", { name: "Ganaste" })).toBeInTheDocument();
    expect(screen.getByText("¡Ganaste!")).toHaveClass("end-title");
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
    expect(screen.getByText("Última persona en la mesa.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a la sala" })).toHaveFocus();
  });

  it("someone else's win names them, over rays and falling shells", () => {
    render(
      <EndScreen winnerName="<b>Beto</b>" isMe={false} sub="x">
        <button>Jugar de nuevo</button>
      </EndScreen>,
    );
    expect(screen.getByRole("dialog", { name: "Ganó <b>Beto</b>" })).toBeInTheDocument();
    // A player name is text, never markup.
    expect(screen.getByText("<b>Beto</b>")).toHaveClass("end-winner");
    expect(document.querySelector(".end-rays")).toBeInTheDocument();
    expect(document.querySelectorAll(".end-confetti i").length).toBeGreaterThan(0);
  });
});

describe("EliminationBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("someone else is out: Eliminado and their name", () => {
    render(<EliminationBanner name="Tomi" isMe={false} whoHtml="<b>Lucía</b> le dispara a <b>Tomi</b>." onContinue={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveClass("elim-overlay");
    expect(screen.getByText("Eliminado")).toBeInTheDocument();
    expect(screen.getByText("Tomi", { selector: ".elim-name" })).toBeInTheDocument();
    expect(document.querySelector(".elim-who")?.textContent).toBe("Lucía le dispara a Tomi.");
  });

  it("me out: Quedaste afuera, no name", () => {
    render(<EliminationBanner name="Ana" isMe onContinue={vi.fn()} />);
    expect(screen.getByText("Quedaste afuera")).toBeInTheDocument();
    expect(screen.queryByText("Ana")).not.toBeInTheDocument();
  });

  it("moves on once on a tap", () => {
    const onContinue = vi.fn();
    render(<EliminationBanner name="Tomi" isMe={false} onContinue={onContinue} />);
    act(() => void vi.advanceTimersByTime(BANNER_TAP_GUARD_MS + 10));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("moves on by itself, after a longer beat than an ordinary result", () => {
    const onContinue = vi.fn();
    render(<EliminationBanner name="Tomi" isMe={false} onContinue={onContinue} />);
    act(() => void vi.advanceTimersByTime(BANNER_AUTO_MS + 50));
    expect(onContinue).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(ELIMINATION_AUTO_MS));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
