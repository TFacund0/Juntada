import { describe, expect, it } from "vitest";
import { buildDefaultDescriptions, cardKey, getDescription, orderedDeck, SUIT_IDS, VALUES } from "./index";

describe("orderedDeck", () => {
  it("builds every suit/value combination exactly once", () => {
    const deck = orderedDeck();
    expect(deck).toHaveLength(SUIT_IDS.length * VALUES.length);
    const keys = new Set(deck.map(c => cardKey(c.suit, c.value)));
    expect(keys.size).toBe(deck.length);
  });
});

describe("buildDefaultDescriptions", () => {
  it("gives every card in the deck a non-empty description", () => {
    const descriptions = buildDefaultDescriptions();
    for (const card of orderedDeck()) {
      expect(getDescription(descriptions, card)).not.toBe("");
    }
  });

  it("doubles the punishment specifically for the 1 of oro", () => {
    const descriptions = buildDefaultDescriptions();
    expect(descriptions[cardKey("oro", 1)]).toContain("doble");
    expect(descriptions[cardKey("copa", 1)]).not.toContain("doble");
  });
});

describe("getDescription", () => {
  it("returns an empty string for a null card", () => {
    expect(getDescription(buildDefaultDescriptions(), null)).toBe("");
  });
});
