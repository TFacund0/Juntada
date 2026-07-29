import { test } from "node:test";
import assert from "node:assert/strict";
import { SUIT_IDS, VALUES, cardKey, buildDefaultDescriptions, getDescription, orderedDeck } from "@juntada/limon-limon-deck";

test("orderedDeck has 40 cards: 4 suits x 10 values, no duplicates", () => {
  const deck = orderedDeck();
  assert.equal(deck.length, SUIT_IDS.length * VALUES.length);
  const keys = new Set(deck.map(c => cardKey(c.suit, c.value)));
  assert.equal(keys.size, deck.length);
});

test("buildDefaultDescriptions covers every card, with the oro-1 override applied", () => {
  const descriptions = buildDefaultDescriptions();
  for (const suit of SUIT_IDS) {
    for (const value of VALUES) {
      assert.ok(descriptions[cardKey(suit, value)], `missing description for ${suit}-${value}`);
    }
  }
  assert.notEqual(descriptions[cardKey("oro", 1)], descriptions[cardKey("copa", 1)]);
});

test("getDescription looks up by suit+value and tolerates a missing card", () => {
  const descriptions = buildDefaultDescriptions();
  assert.equal(getDescription(descriptions, { suit: "oro", value: 1 }), descriptions["oro-1"]);
  assert.equal(getDescription(descriptions, null), "");
  assert.equal(getDescription(undefined, { suit: "oro", value: 1 }), "");
});
