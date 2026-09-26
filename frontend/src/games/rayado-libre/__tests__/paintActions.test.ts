import { describe, expect, test } from "vitest";
import type { DrawAction } from "@juntada/rayado-libre-scoring";
import { actionsEqual, isHistoryExtension, paintHistory } from "../utils/paintActions";
import { PAPER_COLOR } from "../utils/board";

const stroke = (strokeId: number, points: [number, number][] = [[1, 1]], color = "#000"): DrawAction => ({
  type: "stroke",
  points,
  color,
  size: 4,
  strokeId,
});
const clear: DrawAction = { type: "clear" };

// Contexto 2D falso: registra qué se pintó (papel y trazos), sin canvas real.
function recordingCtx() {
  const ops: string[] = [];
  const ctx = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    fillRect: () => ops.push(`paper:${ctx.fillStyle}`),
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => ops.push(`stroke:${ctx.strokeStyle}`),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

describe("actionsEqual", () => {
  test("compares by value, not identity (actions arrive re-parsed from JSON)", () => {
    expect(actionsEqual(stroke(1, [[1, 2]]), stroke(1, [[1, 2]]))).toBe(true);
    expect(actionsEqual(clear, { type: "clear" })).toBe(true);
    expect(actionsEqual({ type: "fill", x: 1, y: 2, color: "red" }, { type: "fill", x: 1, y: 2, color: "red" })).toBe(true);
  });

  test("any differing field makes them different", () => {
    expect(actionsEqual(stroke(1, [[1, 2]]), stroke(1, [[1, 3]]))).toBe(false);
    expect(actionsEqual(stroke(1), stroke(2))).toBe(false);
    expect(actionsEqual(stroke(1, [[1, 1]], "#000"), stroke(1, [[1, 1]], "#fff"))).toBe(false);
    expect(
      actionsEqual(
        stroke(1, [[1, 1]]),
        stroke(1, [
          [1, 1],
          [2, 2],
        ]),
      ),
    ).toBe(false);
    expect(actionsEqual({ type: "fill", x: 1, y: 2, color: "red" }, { type: "fill", x: 1, y: 2, color: "blue" })).toBe(false);
    expect(actionsEqual(stroke(1), clear)).toBe(false);
  });
});

describe("isHistoryExtension", () => {
  test("new actions appended at the end (the usual network flush)", () => {
    expect(isHistoryExtension([], [stroke(1)])).toBe(true);
    expect(isHistoryExtension([stroke(1)], [stroke(1), stroke(2)])).toBe(true);
    expect(isHistoryExtension([stroke(1)], [stroke(1)])).toBe(true);
  });

  test("undo, the backend cap dropping old actions, or a different history are not extensions", () => {
    expect(isHistoryExtension([stroke(1), stroke(2)], [stroke(1)])).toBe(false);
    expect(isHistoryExtension([stroke(1), stroke(2)], [stroke(2), stroke(3)])).toBe(false);
    expect(isHistoryExtension([stroke(1)], [stroke(9)])).toBe(false);
  });
});

describe("paintHistory", () => {
  test("an extension paints only the new actions, on top of what is there", () => {
    const { ctx, ops } = recordingCtx();
    paintHistory(ctx, [stroke(1, [[1, 1]], "#111")], [stroke(1, [[1, 1]], "#111"), stroke(2, [[2, 2]], "#222")]);
    expect(ops).toEqual(["stroke:#222"]);
  });

  test("anything else repaints from a blank sheet", () => {
    const { ctx, ops } = recordingCtx();
    paintHistory(ctx, [stroke(1, [[1, 1]], "#111"), stroke(2, [[2, 2]], "#222")], [stroke(1, [[1, 1]], "#111")]);
    expect(ops).toEqual([`paper:${PAPER_COLOR}`, "stroke:#111"]);
  });

  test("`full` forces the repaint even for an extension, and `clear` paints paper", () => {
    const { ctx, ops } = recordingCtx();
    paintHistory(ctx, [], [stroke(1, [[1, 1]], "#111"), clear], true);
    expect(ops).toEqual([`paper:${PAPER_COLOR}`, "stroke:#111", `paper:${PAPER_COLOR}`]);
  });
});
