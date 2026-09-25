import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@juntada/recamara-engine";
import { ChamberStrip } from "../components/ChamberStrip";
import { ItemTray } from "../components/ItemTray";
import { DuelTable } from "../components/DuelTable";
import type { ShotAnimation } from "../hooks/shotAnimation";

describe("ChamberStrip", () => {
  it("mute on the left, the round in the middle, direction on the right — and nothing about the chamber", async () => {
    const onToggleMute = vi.fn();
    const { container } = render(<ChamberStrip roundNumber={2} direction={1} muted={false} onToggleMute={onToggleMute} />);
    const left = container.querySelector(".chamber-strip-left")!;
    const center = container.querySelector(".chamber-strip-center")!;
    expect(left).not.toHaveTextContent("Ronda");
    expect(center).toHaveTextContent("Ronda 2");
    await userEvent.setup().click(screen.getByRole("button", { name: "Silenciar sonido" }));
    expect(onToggleMute).toHaveBeenCalledTimes(1);
    expect(left.contains(screen.getByRole("button", { name: "Silenciar sonido" }))).toBe(true);
    expect(screen.getByTitle("Sentido horario")).toBeInTheDocument();
    // Not even what my own 🔍 showed: that stays in its reveal only.
    expect(center).toHaveTextContent(/^Ronda 2$/);
    expect(container.querySelector(".mini")).toBeNull();
  });

  it("counter-clockwise direction", () => {
    render(<ChamberStrip roundNumber={1} direction={-1} muted={true} onToggleMute={vi.fn()} />);
    expect(screen.getByTitle("Sentido antihorario")).toBeInTheDocument();
  });
});

describe("ItemTray", () => {
  it("one big button per item with its short name, calling onUse", async () => {
    const onUse = vi.fn();
    render(<ItemTray items={["🪚", "🔍"]} disabled={false} onUse={onUse} />);
    expect(screen.getByText("Sierra")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Lupa" }));
    expect(onUse).toHaveBeenCalledWith("🔍");
  });

  it("no hover tooltip: an item's description only shows once it's pressed", () => {
    render(<ItemTray items={["🪚"]} disabled={false} onUse={vi.fn()} />);
    const saw = screen.getByRole("button", { name: "Sierra" });
    expect(saw).not.toHaveAttribute("data-tooltip");
    expect(saw).not.toHaveAttribute("title");
  });

  it("an item that can't be used right now (a second 🧤 this turn) is disabled and says why", () => {
    render(<ItemTray items={["🧤", "🔍"]} disabled={false} isUsable={item => item !== "🧤"} onUse={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ladrón (ya usado este turno)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lupa" })).toBeEnabled();
  });

  it("renders nothing without items", () => {
    const { container } = render(<ItemTray items={[]} disabled={false} onUse={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DuelTable targeting", () => {
  const players: Player[] = [
    { id: 0, name: "Ana", lives: 5, items: [], lastGrantedItems: [] },
    { id: 1, name: "Beto", lives: 3, items: [], lastGrantedItems: [] },
    { id: 2, name: "Caro", lives: 0, items: [], lastGrantedItems: [] },
  ];
  const anim = { fireStage: "idle", busy: false, recoil: false, flash: false, gunAngle: 0, spentShells: [] } as unknown as ShotAnimation;
  const renderTable = (onFire?: (id: number) => void, busy = false) => {
    const onSelectPlayer = vi.fn();
    render(
      <DuelTable
        order={[0, 1, 2]}
        players={players}
        currentId={0}
        direction={1}
        sawedOff={false}
        busy={busy}
        shotAnim={anim}
        onSelectPlayer={onSelectPlayer}
        youId={0}
        onFire={onFire}
      />,
    );
    return onSelectPlayer;
  };

  it("on my turn living rivals are targets: tapping one fires at it", async () => {
    const onFire = vi.fn();
    const onSelectPlayer = renderTable(onFire);
    await userEvent.setup().click(screen.getByRole("button", { name: "Dispararle a Beto" }));
    expect(onFire).toHaveBeenCalledWith(1);
    expect(onSelectPlayer).not.toHaveBeenCalled();
    // Not the shooter, not the dead.
    expect(screen.queryByRole("button", { name: "Dispararle a Ana" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dispararle a Caro" })).not.toBeInTheDocument();
    expect(document.querySelector(".token.you")).toHaveTextContent("Ana");
  });

  it("without onFire (or while busy) cards just open the item sheet", async () => {
    const onSelectPlayer = renderTable(undefined);
    expect(screen.queryByRole("button", { name: /^Dispararle a/ })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Beto", { selector: ".token-name" }));
    expect(onSelectPlayer).toHaveBeenCalledWith(1);
  });
});
