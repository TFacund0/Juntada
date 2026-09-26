import { describe, expect, test } from "vitest";
import { cursorFor } from "../utils/cursorSvg";

const svgOf = (cursor: string) => decodeURIComponent(/data:image\/svg\+xml,([^"]+)"/.exec(cursor)?.[1] ?? "");

describe("cursorFor", () => {
  test("the bucket is a plain crosshair", () => {
    expect(cursorFor({ mode: "fill", color: "#e2432a", size: 10 }, 800)).toBe("crosshair");
  });

  test("pencil: URL-encoded SVG circle of the real stroke size and color, hotspot centered", () => {
    const cursor = cursorFor({ mode: "draw", color: "#e2432a", size: 20 }, 800);
    // Escala 1: radio 10, lado 24, punto caliente en el centro.
    expect(cursor).toMatch(/^url\("data:image\/svg\+xml,[^"\s<>]+"\) 12 12, crosshair$/);
    const svg = svgOf(cursor);
    expect(svg).toContain("width='24' height='24'");
    expect(svg).toContain("r='10'");
    expect(svg).toContain("fill='#e2432a' fill-opacity='.35'");
    expect(svg).toContain("stroke='#e2432a'");
  });

  test("scales with the on-screen board width", () => {
    const svg = svgOf(cursorFor({ mode: "draw", color: "#1a1a1a", size: 20 }, 400));
    expect(svg).toContain("r='5'");
  });

  test("eraser: unfilled circle with a dark outline, at the eraser width (size x 2.5)", () => {
    const svg = svgOf(cursorFor({ mode: "erase", color: "#e2432a", size: 20 }, 800));
    expect(svg).toContain("r='25'");
    expect(svg).toContain("fill='none'");
    expect(svg).toContain("stroke='#333'");
  });

  test("never smaller than radius 3, and falls back to half scale before the board is measured", () => {
    expect(svgOf(cursorFor({ mode: "draw", color: "#1a1a1a", size: 4 }, 100))).toContain("r='3'");
    expect(svgOf(cursorFor({ mode: "draw", color: "#1a1a1a", size: 20 }, 0))).toContain("r='5'");
  });
});
