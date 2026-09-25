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
    spentShells: [],
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
    // The first seat sits at the top of the table (seatAngle -90°), far
    // enough in that its standing card stays inside the rim.
    expect((seats[0] as HTMLElement).style.left).toBe("50%");
    expect((seats[0] as HTMLElement).style.top).toBe("19%");
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

  it("shows the last casing at its landing spot, and fades the previous one out", () => {
    expect(renderTable().container.querySelector(".spent-shell")).toBeNull();

    const { container } = renderTable({
      shotAnim: shotAnim({
        spentShells: [
          { id: 1, kind: "live", left: 30, top: 70, rot: 45 },
          { id: 2, kind: "blank", left: 60, top: 35, rot: -90 },
        ],
      }),
    });
    const shells = container.querySelectorAll<HTMLElement>(".spent-shell");
    expect(shells).toHaveLength(2);
    expect(shells[0]).toHaveClass("live", "fading");
    expect(shells[0].style.getPropertyValue("--x")).toBe("30%");
    expect(shells[0].style.getPropertyValue("--y")).toBe("70%");
    expect(shells[1]).toHaveClass("blank");
    expect(shells[1]).not.toHaveClass("fading");
  });

  it("on a live trigger: the scene shakes hard, the target's card takes the hit and the screen flashes", () => {
    const { container } = renderTable({
      shotAnim: shotAnim({ fireStage: "firing" }),
      playing: { id: 1, kind: "shot", shellKind: "live", targetId: 2, targetIsMe: true },
    });
    expect(container.querySelector(".duel-stage")).toHaveClass("shake-live");
    const hit = container.querySelectorAll(".seat.hit");
    expect(hit).toHaveLength(1);
    expect(hit[0]).toHaveTextContent("Caro");
    expect(container.querySelector(".shot-flash")).toBeInTheDocument();
    expect(container.querySelector(".shot-hurt")).toBeInTheDocument();
  });

  it("a blank only twitches the scene: no hit, no flash", () => {
    const { container } = renderTable({
      shotAnim: shotAnim({ fireStage: "firing" }),
      playing: { id: 1, kind: "shot", shellKind: "blank", targetId: 2 },
    });
    expect(container.querySelector(".duel-stage")).toHaveClass("shake-blank");
    expect(container.querySelector(".seat.hit")).toBeNull();
    expect(container.querySelector(".shot-flash")).toBeNull();
  });

  it("the gun trembles while aiming, and nothing else fires yet", () => {
    const { container } = renderTable({
      shotAnim: shotAnim({ fireStage: "aiming" }),
      playing: { id: 1, kind: "shot", shellKind: "live", targetId: 2 },
    });
    expect(container.querySelector(".shotgun")).toHaveClass("aiming");
    expect(container.querySelector(".duel-stage")?.className).toBe("duel-stage");
    expect(container.querySelector(".shot-flash")).toBeNull();
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
