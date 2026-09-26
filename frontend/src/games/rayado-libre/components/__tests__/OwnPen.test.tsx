import { createRef } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { OwnPen, type OwnPenHandle } from "../OwnPen";

describe("OwnPen", () => {
  test("follows the pencil tip while it is down and hides when it lifts", () => {
    const ref = createRef<OwnPenHandle>();
    const { container } = render(<OwnPen ref={ref} color="#e2432a" />);
    const svg = container.querySelector("svg")!;
    expect(svg).toHaveClass("opacity-0");
    expect(svg.style.opacity).toBe("");

    act(() => ref.current!.move([400, 200]));
    expect(svg.style.left).toBe("50%");
    expect(svg.style.top).toBe("25%");
    expect(svg.style.opacity).toBe("1");

    act(() => ref.current!.move(null));
    expect(svg.style.opacity).toBe("");
  });
});
