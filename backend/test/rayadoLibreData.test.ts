const { test } = require("node:test");
const assert = require("node:assert/strict");
const { activeWordPool, pickThreeWords } = require("@juntada/rayado-libre-data") as {
  activeWordPool: (categories: Record<string, { label: string; icon: string; words: string[] }>, activeKeys: string[]) => string[];
  pickThreeWords: (pool: string[], usedWords: string[]) => { words: string[]; resetUsed: boolean };
};

const CATEGORIES = {
  animales: { label: "Animales", icon: "🦁", words: ["Perro", "Gato", "León"] },
  comida: { label: "Comida", icon: "🍕", words: ["Pizza", "Sushi"] },
};

test("activeWordPool combines only the active categories' words", () => {
  assert.deepEqual(activeWordPool(CATEGORIES, ["animales"]), ["Perro", "Gato", "León"]);
  assert.deepEqual(activeWordPool(CATEGORIES, ["animales", "comida"]), ["Perro", "Gato", "León", "Pizza", "Sushi"]);
  assert.deepEqual(activeWordPool(CATEGORIES, []), []);
});

test("pickThreeWords excludes already-used words while enough remain", () => {
  const pool = ["a", "b", "c", "d", "e"];
  const { words, resetUsed } = pickThreeWords(pool, ["a", "b"]);
  assert.equal(words.length, 3);
  assert.ok(words.every(w => !["a", "b"].includes(w)));
  assert.equal(resetUsed, false);
});

test("pickThreeWords falls back to allowing repeats once fewer than 3 remain unused, and reports resetUsed", () => {
  const pool = ["a", "b", "c"];
  const { words, resetUsed } = pickThreeWords(pool, ["a", "b"]);
  assert.equal(words.length, 3);
  assert.equal(resetUsed, true);
});

test("pickThreeWords never returns more words than the pool has", () => {
  const pool = ["a", "b"];
  const { words } = pickThreeWords(pool, []);
  assert.equal(words.length, 2);
});
