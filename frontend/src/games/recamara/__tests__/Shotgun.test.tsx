import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Shotgun } from "../components/Shotgun";

describe("Shotgun", () => {
  it("renders at rest: no recoil, no sawed barrel, muzzle flash off", () => {
    const { container } = render(<Shotgun />);
    const gun = container.querySelector(".shotgun")!;
    expect(gun.className).toBe("shotgun");
    expect(container.querySelector(".shotgun-muzzle-fire")).not.toHaveClass("flash");
  });

  it("recoil, flash and sawed each map to their own class", () => {
    const { container } = render(<Shotgun recoil flash sawed />);
    expect(container.querySelector(".shotgun")).toHaveClass("recoil", "sawed");
    expect(container.querySelector(".shotgun-muzzle-fire")).toHaveClass("flash");
  });

  it("two shotguns on screen never share gradient ids", () => {
    const { container } = render(
      <>
        <Shotgun />
        <Shotgun />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient, radialGradient")).map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Every fill points at a gradient defined inside its own svg.
    container.querySelectorAll("svg").forEach(svg => {
      const own = new Set(Array.from(svg.querySelectorAll("[id]")).map(g => g.id));
      svg.querySelectorAll("[fill^='url(#']").forEach(el => {
        expect(own.has(el.getAttribute("fill")!.slice(5, -1))).toBe(true);
      });
    });
  });

  it("is decorative for assistive tech", () => {
    const { container } = render(<Shotgun />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
