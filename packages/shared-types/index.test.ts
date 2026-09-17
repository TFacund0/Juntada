import { describe, expect, it } from "vitest";
import { SCHEMAS } from "./index";

describe("SCHEMAS.join_room", () => {
  it("accepts a valid room code and name", () => {
    const result = SCHEMAS.join_room.safeParse({ type: "join_room", code: "ABC123", playerName: "Juan" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty room code", () => {
    const result = SCHEMAS.join_room.safeParse({ type: "join_room", code: "" });
    expect(result.success).toBe(false);
  });
});

describe("SCHEMAS.update_config", () => {
  it("rejects a config with more than 50 keys (anti-spam guard)", () => {
    const config = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`key${i}`, "value"]));
    const result = SCHEMAS.update_config.safeParse({ type: "update_config", config });
    expect(result.success).toBe(false);
  });

  it("rejects a free-text config value over 300 chars (anti-broadcast-spam guard)", () => {
    const config = { note: "x".repeat(301) };
    const result = SCHEMAS.update_config.safeParse({ type: "update_config", config });
    expect(result.success).toBe(false);
  });

  it("accepts a small, valid config", () => {
    const result = SCHEMAS.update_config.safeParse({ type: "update_config", config: { rounds: 3, hints: true } });
    expect(result.success).toBe(true);
  });
});

describe("SCHEMAS.draw_stroke", () => {
  it("rejects coordinates far outside the tolerated canvas margin", () => {
    const result = SCHEMAS.draw_stroke.safeParse({
      type: "draw_stroke",
      points: [[99999, 99999]],
      color: "#000000",
      size: 5,
      strokeId: 1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts coordinates within the tolerated overshoot margin", () => {
    const result = SCHEMAS.draw_stroke.safeParse({
      type: "draw_stroke",
      points: [[-100, 700]],
      color: "#000000",
      size: 5,
      strokeId: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe("SCHEMAS.use_item", () => {
  it("rejects an item outside the fixed emoji pool", () => {
    const result = SCHEMAS.use_item.safeParse({ type: "use_item", item: "💣" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid item with no target", () => {
    const result = SCHEMAS.use_item.safeParse({ type: "use_item", item: "🔍" });
    expect(result.success).toBe(true);
  });
});
