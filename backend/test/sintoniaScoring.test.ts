import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreFor } from "@juntada/sintonia-scoring";

test("scoreFor awards points by distance-from-target tiers", () => {
  assert.equal(scoreFor(0), 4);
  assert.equal(scoreFor(3), 4);
  assert.equal(scoreFor(4), 3);
  assert.equal(scoreFor(8), 3);
  assert.equal(scoreFor(9), 2);
  assert.equal(scoreFor(15), 2);
  assert.equal(scoreFor(16), 0);
  assert.equal(scoreFor(100), 0);
});
