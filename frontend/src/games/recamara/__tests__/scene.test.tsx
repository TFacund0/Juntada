import { describe, expect, it, vi } from "vitest";
import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Player } from "@juntada/recamara-engine";
import { statusLine } from "../utils/statusLine";
import { aimingAt, shellsLeft } from "../utils/scene";
import { useKnownShell } from "../hooks/knownShell";
import { ChamberStrip } from "../components/ChamberStrip";
import { ItemTray } from "../components/ItemTray";
import { DuelTable } from "../components/DuelTable";
import type { PlayingFx } from "../utils/playingFx";
import type { ShotAnimation } from "../hooks/shotAnimation";

const text = (segments: ReturnType<typeof statusLine>) => segments.map(s => s.text).join("");

describe("statusLine", () => {
  it("my turn / someone else's / pass-and-play / eliminated", () => {
    expect(text(statusLine({ currentName: "Ana", currentIsMe: true }))).toMatch(/^Te toca\. Tocá a un rival/);
    expect(text(statusLine({ currentName: "Beto", currentIsMe: false }))).toBe("Turno de Beto…");
    expect(text(statusLine({ currentName: "Beto", currentIsMe: false, passAndPlay: true }))).toMatch(/^Te toca, Beto\./);
    expect(text(statusLine({ currentName: "Beto", currentIsMe: false, amEliminated: true }))).toBe("Quedaste afuera. Mirá cómo termina.");
  });

  it("while aiming it narrates who points at whom", () => {
    const at = (targetName: string, targetIsMe: boolean, targetIsShooter: boolean, currentIsMe = false) =>
      text(statusLine({ currentName: "Lucía", currentIsMe, aiming: { targetName, targetIsMe, targetIsShooter } }));
    expect(at("Tomi", false, false)).toBe("Lucía apunta a Tomi…");
    expect(at("Vos", true, false)).toBe("Lucía apunta a vos…");
    expect(at("Lucía", false, true)).toBe("Lucía apunta a sí mismo…");
    expect(at("Tomi", false, false, true)).toBe("Vos apuntás a Tomi…");
  });

  it("names are plain text segments, never markup", () => {
    const segs = statusLine({ currentName: "<img onerror=x>", currentIsMe: false });
    expect(segs.find(s => s.bold)?.text).toBe("<img onerror=x>");
  });
});

describe("scene helpers", () => {
  const shells = [{ spent: true }, { spent: false }, { spent: false }];
  const shot: PlayingFx = { id: 1, kind: "shot", shellKind: "live", targetId: 1 };

  it("shellsLeft drops the shot being played once its trigger is pulled", () => {
    expect(shellsLeft(shells, null, "idle")).toBe(2);
    expect(shellsLeft(shells, shot, "aiming")).toBe(2);
    expect(shellsLeft(shells, shot, "firing")).toBe(1);
    expect(shellsLeft(shells, shot, "result")).toBe(1);
  });

  it("aimingAt resolves the target's name and whether it's me or the shooter", () => {
    const players = [
      { id: 0, name: "Ana" },
      { id: 1, name: "Beto" },
    ] as Player[];
    expect(aimingAt(shot, players, 0, 1)).toEqual({ targetName: "Beto", targetIsMe: true, targetIsShooter: false });
    expect(aimingAt(shot, players, 1)).toEqual({ targetName: "Beto", targetIsMe: false, targetIsShooter: true });
  });
});

describe("useKnownShell", () => {
  it("remembers what my 🔍 showed until the next shot or reload", () => {
    const lens: PlayingFx = { id: 1, kind: "item", item: "🔍", revealedShellKind: "live" };
    const { result, rerender } = renderHook(({ fx, round }) => useKnownShell(fx, round), {
      initialProps: { fx: null as PlayingFx | null, round: 1 },
    });
    expect(result.current).toBeNull();
    rerender({ fx: lens, round: 1 });
    expect(result.current).toBe("live");
    rerender({ fx: null, round: 1 });
    expect(result.current).toBe("live");
    rerender({ fx: { id: 2, kind: "shot" }, round: 1 });
    expect(result.current).toBeNull();

    rerender({ fx: { ...lens, id: 3 }, round: 1 });
    rerender({ fx: null, round: 2 });
    expect(result.current).toBeNull();
  });

  it("someone else's 🔍 (no revealed shell) tells this device nothing", () => {
    const { result } = renderHook(() => useKnownShell({ id: 1, kind: "item", item: "🔍", revealedShellKind: null }, 1));
    expect(result.current).toBeNull();
  });
});

describe("ChamberStrip", () => {
  it("shows the round, one mini per shell (fired ones marked gone) and the 🔍 pill", () => {
    const { container } = render(<ChamberStrip roundNumber={2} shellsTotal={5} shellsLeft={3} known="blank" direction={1} />);
    expect(screen.getByText("Ronda 2")).toBeInTheDocument();
    expect(container.querySelectorAll(".mini")).toHaveLength(5);
    expect(container.querySelectorAll(".mini.gone")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "3 cartuchos en la recámara" })).toBeInTheDocument();
    expect(screen.getByText("La próxima es FALSA")).toBeInTheDocument();
  });

  it("no pill without a 🔍 result", () => {
    render(<ChamberStrip roundNumber={1} shellsTotal={3} shellsLeft={3} known={null} direction={-1} />);
    expect(screen.queryByText(/La próxima es/)).not.toBeInTheDocument();
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
