import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { useClearFx } from "../hooks/useClearFx";

const stroke = (strokeId: number): DrawAction => ({ type: "stroke", points: [[1, 1]], color: "#1a1a1a", size: 10, strokeId });
const drawing = [stroke(1), stroke(2)];
const single = [stroke(1), stroke(1)];
const empty: DrawAction[] = [];

function mount(strokes: DrawAction[], resetKey = "a", clearRequest = 0) {
  return renderHook(p => useClearFx(p.strokes, p.resetKey, p.clearRequest), { initialProps: { strokes, resetKey, clearRequest } });
}

describe("useClearFx", () => {
  test("a guesser sees the clear when the board they receive empties", () => {
    const { result, rerender } = mount(drawing);
    expect(result.current).toBe(0);
    rerender({ strokes: empty, resetKey: "a", clearRequest: 0 });
    expect(result.current).toBe(1);
  });

  test("asking for another word empties the board without the clear effect", () => {
    const { result, rerender } = mount(drawing, "turn1:false");
    rerender({ strokes: empty, resetKey: "turn1:true", clearRequest: 0 });
    expect(result.current).toBe(0);
  });

  test("undoing the only thing on the board is not a clear", () => {
    const { result, rerender } = mount(single);
    rerender({ strokes: empty, resetKey: "a", clearRequest: 0 });
    expect(result.current).toBe(0);
  });

  test("the drawer's confirmed clear counts even with a single stroke, once it arrives", () => {
    const { result, rerender } = mount(single);
    rerender({ strokes: single, resetKey: "a", clearRequest: 1 });
    expect(result.current).toBe(0);
    rerender({ strokes: [...single], resetKey: "a", clearRequest: 1 });
    rerender({ strokes: empty, resetKey: "a", clearRequest: 1 });
    expect(result.current).toBe(1);
    // Ya consumido: el próximo vaciado de un solo trazo vuelve a ser "deshacer".
    rerender({ strokes: single, resetKey: "a", clearRequest: 1 });
    rerender({ strokes: [], resetKey: "a", clearRequest: 1 });
    expect(result.current).toBe(1);
  });
});
