import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWord, startsWithLetter } from "@juntada/tutifruti-words";

test("normalizeWord trims, lowercases, and strips accents", () => {
  assert.equal(normalizeWord("  Árbol  "), "arbol");
  assert.equal(normalizeWord("ÑOÑO"), "nono");
  assert.equal(normalizeWord(undefined), "");
});

test("startsWithLetter matches case- and accent-insensitively", () => {
  assert.equal(startsWithLetter("Árbol", "a"), true);
  assert.equal(startsWithLetter("banana", "a"), false);
  assert.equal(startsWithLetter("", "a"), true); // empty word is treated as not-yet-wrong
});
