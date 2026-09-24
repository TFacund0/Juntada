import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@juntada/recamara-engine";
import { DuelTable } from "../components/DuelTable";
import type { ShotAnimation } from "../hooks/shotAnimation";

const players: Player[] = [
  { id: 0, name: "Ana", lives: 5, items: [], lastGrantedItems: [] },
  { id: 1, name: "Beto", lives: 3, items: [], lastGrantedItems: [] },
  { id: 2, name: "Caro", lives: 0, items: [], lastGrantedItems: [] },
];

function shotAnim(overrides: Partial<ShotAnimation> = {}): ShotAnimation {
  return {
    fireStage: "idle",
    busy: false,
    recoil: false,
    flash: false,
    gunAngle: 0,
    lastShell: null,
    shellSpot: { left: 50, top: 50, rot: 0 },
    shellPhase: "eject",
    setGunAngle: vi.fn(),
    playShot: vi.fn(() => () => {}),
    finishShot: vi.fn(),
    resetRecoilFlash: vi.fn(),
    resetForNewRound: vi.fn(),
    ...overrides,
  };
}

function renderTable(props: Partial<Parameters<typeof DuelTable>[0]> = {}) {
  const onSelectPlayer = vi.fn();
  const utils = render(
    <DuelTable
      order={[0, 1, 2]}
      players={players}
      currentId={1}
      direction={1}
      sawedOff={false}
      busy={false}
      shotAnim={shotAnim()}
      onSelectPlayer={onSelectPlayer}
      {...props}
    />,
  );
  return { ...utils, onSelectPlayer };
}

describe("DuelTable", () => {
  it("seats every player on the table, one standing card each, in seat order", () => {
    const { container } = renderTable();
    const seats = container.querySelectorAll(".arena > .seat");
    expect(seats).toHaveLength(3);
    expect(Array.from(seats).map(s => s.querySelector(".token-name")?.textContent)).toEqual(["Ana", "Beto", "💀 Caro"]);
    // The first seat sits at the top of the table (seatAngle -90°).
    expect((seats[0] as HTMLElement).style.left).toBe("50%");
    expect((seats[0] as HTMLElement).style.top).toBe("10%");
  });

  it("highlights whoever's turn it is", () => {
    const { container } = renderTable();
    const active = container.querySelectorAll(".token.active");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Beto");
  });

  it("points the gun by shotAnim.gunAngle and saws it off with the table state", () => {
    const { container } = renderTable({ sawedOff: true, shotAnim: shotAnim({ gunAngle: 135, recoil: true }) });
    expect((container.querySelector(".gun-aim") as HTMLElement).style.transform).toContain("rotate(135deg)");
    expect(container.querySelector(".shotgun")).toHaveClass("sawed", "recoil");
  });

  it("shows the last spent shell only once one was fired, at its landing spot", () => {
    expect(renderTable().container.querySelector(".last-shell")).toBeNull();

    const { container } = renderTable({
      shotAnim: shotAnim({ lastShell: "live", shellPhase: "landed", shellSpot: { left: 30, top: 70, rot: 45 } }),
    });
    const shell = container.querySelector(".last-shell") as HTMLElement;
    expect(shell).toHaveClass("live");
    expect(shell.style.left).toBe("30%");
    expect(shell.style.top).toBe("70%");
  });

  it("uses nameFor to relabel a seat (online shows your own as Vos)", () => {
    renderTable({ nameFor: p => (p.id === 0 ? "Vos" : p.name) });
    expect(screen.getByText("Vos", { selector: ".token-name" })).toBeInTheDocument();
    expect(screen.queryByText("Ana", { selector: ".token-name" })).not.toBeInTheDocument();
  });

  it("tapping a card selects that player, but not while a shot is playing", async () => {
    const user = userEvent.setup();
    const { onSelectPlayer, unmount } = renderTable();
    await user.click(screen.getByText("Beto", { selector: ".token-name" }));
    expect(onSelectPlayer).toHaveBeenCalledWith(1);
    unmount();

    const busy = renderTable({ busy: true });
    await user.click(screen.getByText("Beto", { selector: ".token-name" }));
    expect(busy.onSelectPlayer).not.toHaveBeenCalled();
  });
});
