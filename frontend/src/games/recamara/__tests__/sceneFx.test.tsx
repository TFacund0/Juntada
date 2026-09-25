import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { Player } from "@juntada/recamara-engine";
import { DuelTable } from "../components/DuelTable";
import { PlayerToken } from "../components/PlayerToken";
import { ShotEffects } from "../components/ShotEffects";
import type { ShotAnimation } from "../hooks/shotAnimation";
import type { PlayingFx } from "../utils/playingFx";

const players: Player[] = [
  { id: 0, name: "Ana", lives: 3, items: [], lastGrantedItems: [] },
  { id: 1, name: "Beto", lives: 4, items: [], lastGrantedItems: [] },
];

const anim = (fireStage: ShotAnimation["fireStage"] = "idle") =>
  ({ fireStage, busy: false, recoil: false, flash: false, gunAngle: 0, spentShells: [] }) as unknown as ShotAnimation;

function renderTable(playing: PlayingFx | null, opts: { fireStage?: ShotAnimation["fireStage"]; itemActivating?: boolean } = {}) {
  return render(
    <DuelTable
      order={[0, 1]}
      players={players}
      currentId={0}
      direction={1}
      sawedOff={false}
      busy={true}
      shotAnim={anim(opts.fireStage)}
      onSelectPlayer={vi.fn()}
      playing={playing}
      itemActivating={opts.itemActivating}
    />,
  ).container;
}

const seatOf = (container: HTMLElement, name: string) =>
  Array.from(container.querySelectorAll<HTMLElement>(".seat")).find(s => s.textContent?.includes(name))!;

describe("items on the table", () => {
  it("🪚 works on the gun itself while it activates, not before or after", () => {
    const saw: PlayingFx = { id: 1, kind: "item", item: "🪚", actorId: 0 };
    expect(renderTable(saw, { itemActivating: true }).querySelector(".gun-aim .saw-on-gun")).toBeInTheDocument();
    expect(renderTable(saw, { itemActivating: false }).querySelector(".saw-on-gun")).toBeNull();
  });

  it("🚬 smokes over its user's card and, when it heals, pops the life back in", () => {
    const container = renderTable({ id: 1, kind: "item", item: "🚬", actorId: 1, healed: true }, { itemActivating: true });
    const beto = seatOf(container, "Beto");
    expect(beto.querySelector(".card-smoke")).toBeInTheDocument();
    expect(seatOf(container, "Ana").querySelector(".card-smoke")).toBeNull();
    // Beto has 4 lives on screen: the 5th dot is the one coming back.
    const dots = beto.querySelectorAll(".life-dot");
    expect(dots[4]).toHaveClass("regen");
    expect(beto.querySelectorAll(".life-dot.spent")).toHaveLength(0);
  });

  it("once the smoke clears and its banner is up, the healed life stays on the card", () => {
    const container = renderTable({ id: 1, kind: "item", item: "🚬", actorId: 1, healed: true }, { itemActivating: false });
    const beto = seatOf(container, "Beto");
    expect(beto.querySelector(".card-smoke")).toBeNull();
    expect(beto.querySelectorAll(".life-dot.spent")).toHaveLength(0);
    expect(beto.querySelector(".life-dot.regen")).toBeNull();
  });

  it("a 🚬 at full life smokes but gives nothing back", () => {
    const container = renderTable({ id: 1, kind: "item", item: "🚬", actorId: 1, healed: false }, { itemActivating: true });
    expect(seatOf(container, "Beto").querySelector(".life-dot.regen")).toBeNull();
  });
});

describe("a live hit on the table", () => {
  it("bursts exactly the lives it takes on the target's card, on the trigger", () => {
    const shot: PlayingFx = { id: 1, kind: "shot", shellKind: "live", targetId: 1, damage: 2 };
    const container = renderTable(shot, { fireStage: "firing" });
    const beto = seatOf(container, "Beto");
    const dots = Array.from(beto.querySelectorAll(".life-dot"));
    expect(dots.map(d => d.classList.contains("burst"))).toEqual([false, false, true, true, false]);
    expect(seatOf(container, "Ana").querySelector(".life-dot.burst")).toBeNull();
  });

  it("nothing bursts while still aiming, or on a blank", () => {
    expect(
      renderTable({ id: 1, kind: "shot", shellKind: "live", targetId: 1, damage: 1 }, { fireStage: "aiming" }).querySelector(".burst"),
    ).toBeNull();
    expect(
      renderTable({ id: 1, kind: "shot", shellKind: "blank", targetId: 1 }, { fireStage: "firing" }).querySelector(".burst"),
    ).toBeNull();
  });

  it("while its banner is up, the lives it took stay gone — they don't come back until the state moves on", () => {
    const shot: PlayingFx = { id: 1, kind: "shot", shellKind: "live", targetId: 1, damage: 1 };
    const beto = seatOf(renderTable(shot, { fireStage: "result" }), "Beto");
    const dots = Array.from(beto.querySelectorAll(".life-dot"));
    expect(dots.map(d => d.classList.contains("spent"))).toEqual([false, false, false, true, true]);
    expect(beto.querySelector(".burst")).toBeNull();
  });

  it("the shot that takes the last life knocks the target's card over, from the trigger on", () => {
    const fatal: PlayingFx = { id: 1, kind: "shot", shellKind: "live", targetId: 0, damage: 3, eliminates: true };
    expect(seatOf(renderTable(fatal, { fireStage: "aiming" }), "Ana")).not.toHaveClass("eliminated");
    for (const fireStage of ["firing", "result"] as const) {
      const container = renderTable(fatal, { fireStage });
      expect(seatOf(container, "Ana")).toHaveClass("eliminated");
      expect(seatOf(container, "Beto")).not.toHaveClass("eliminated");
    }
    const survivable: PlayingFx = { ...fatal, damage: 1, eliminates: false };
    expect(renderTable(survivable, { fireStage: "result" }).querySelector(".seat.eliminated")).toBeNull();
  });
});

describe("PlayerToken life dots", () => {
  it("never bursts more lives than the card has", () => {
    const { container } = render(<PlayerToken player={{ ...players[0], lives: 1 }} isActive={false} losing={2} onClick={vi.fn()} />);
    expect(container.querySelectorAll(".life-dot.burst")).toHaveLength(1);
    expect(container.querySelectorAll(".life-dot.spent")).toHaveLength(4);
  });
});

describe("ShotEffects", () => {
  it("the red vignette carries the reference's cracks, only when the live shell hit me", () => {
    const hitMe: PlayingFx = { id: 1, kind: "shot", shellKind: "live", targetId: 0, targetIsMe: true };
    const { container } = render(<ShotEffects shot={hitMe} fireStage="firing" />);
    expect(container.querySelector(".shot-hurt svg path")).toBeInTheDocument();

    const other = render(<ShotEffects shot={{ ...hitMe, targetIsMe: false }} fireStage="firing" />);
    expect(other.container.querySelector(".shot-hurt")).toBeNull();
    expect(other.container.querySelector(".shot-flash")).toBeInTheDocument();
  });
});
