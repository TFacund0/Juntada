import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWord, startsWithLetter } from "@juntada/tutifruti-words";

test("normalizeWord trims, lowercases, and strips accents", () => {
  assert.equal(normalizeWord("  Árbol  "), "arbol");
  assert.equal(normalizeWord(undefined), "");
});

// "ñ" is its own letter in Spanish, not an accented "n" — normalizeWord must
// keep it distinct instead of stripping it down to "n" like it does for
// á/é/í/ó/ú (see the sentinel trick in tutifruti-words/index.ts).
test("normalizeWord keeps ñ distinct from n instead of stripping it like an accent", () => {
  assert.equal(normalizeWord("ÑOÑO"), "ñoño");
  assert.equal(normalizeWord("Nono"), "nono");
  assert.notEqual(normalizeWord("Ñandú"), normalizeWord("Nandu"));
});

test("startsWithLetter matches case- and accent-insensitively", () => {
  assert.equal(startsWithLetter("Árbol", "a"), true);
  assert.equal(startsWithLetter("banana", "a"), false);
  assert.equal(startsWithLetter("", "a"), true); // empty word is treated as not-yet-wrong
});

test("startsWithLetter treats ñ and n as different starting letters", () => {
  assert.equal(startsWithLetter("Ñandú", "Ñ"), true);
  assert.equal(startsWithLetter("Ñandú", "N"), false);
  assert.equal(startsWithLetter("Nube", "Ñ"), false);
  assert.equal(startsWithLetter("Nube", "N"), true);
});
