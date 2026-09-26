import { describe, expect, test } from "vitest";
import { activeTypingIds, nextTypingExpiry, shouldSendTyping } from "../utils/typing";

describe("activeTypingIds", () => {
  test("keeps only marks that haven't expired, in arrival order", () => {
    expect(activeTypingIds({ p2: 1500, p3: 900, p4: 2000 }, 1000)).toEqual(["p2", "p4"]);
  });

  test("never lists the player themselves", () => {
    expect(activeTypingIds({ p2: 1500, p3: 1500 }, 1000, "p2")).toEqual(["p3"]);
  });

  test("nothing typing when there's no data yet", () => {
    expect(activeTypingIds(undefined, 1000)).toEqual([]);
  });
});

describe("nextTypingExpiry", () => {
  test("the earliest expiry still ahead, or null once everything expired", () => {
    expect(nextTypingExpiry({ p2: 1500, p3: 1200, p4: 900 }, 1000)).toBe(1200);
    expect(nextTypingExpiry({ p2: 900 }, 1000)).toBeNull();
    expect(nextTypingExpiry(undefined, 1000)).toBeNull();
  });
});

describe("shouldSendTyping", () => {
  test("sends the first ping, then at most one every 2s", () => {
    expect(shouldSendTyping(null, 5000)).toBe(true);
    expect(shouldSendTyping(5000, 6999)).toBe(false);
    expect(shouldSendTyping(5000, 7000)).toBe(true);
  });
});
