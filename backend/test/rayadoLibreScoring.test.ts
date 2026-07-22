const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildHintOrder, maxHintsFor, computeWordHint, popLastDrawUnit } = require("@juntada/rayado-libre-scoring");

test("buildHintOrder only includes non-space characters, in some shuffled order", () => {
  const order = buildHintOrder("A B");
  assert.deepEqual([...order].sort(), [0, 2]); // index 1 is the space
});

test("buildHintOrder prioritizes the longest word in a phrase, so a short filler word reveals last", () => {
  const word = "Cepillo de dientes"; // "Cepillo"=7, "de"=2, "dientes"=7
  const order = buildHintOrder(word);
  const deIndices = [8, 9]; // positions of "d" and "e" in "de"
  const positionsOfDe = deIndices.map(i => order.indexOf(i));
  const totalRevealable = order.length; // 16 letters (space-separated words excluded)

  // Both letters of "de" should land in the back half of the reveal order —
  // never among the very first hints handed out.
  assert.ok(
    positionsOfDe.every(pos => pos >= totalRevealable - 2),
    `expected "de"'s letters last in the order, got positions ${positionsOfDe} of ${totalRevealable}`,
  );
});

test("buildHintOrder still shuffles within a single word (not left-to-right) when there's no phrase to prioritize", () => {
  // Run several times — with no spaces, every letter belongs to the same
  // single group, so the grouping/sorting logic shouldn't force order 0..n-1.
  const attempts = Array.from({ length: 20 }, () => buildHintOrder("Elefante"));
  const anyShuffled = attempts.some(order => order.join(",") !== "0,1,2,3,4,5,6,7");
  assert.ok(anyShuffled, "expected at least one shuffled (non-identity) order across 20 tries");
});

test("maxHintsFor caps at just under half the revealable letters", () => {
  assert.equal(maxHintsFor("Sol"), 1); // 3 letters -> floor((3-1)/2) = 1
  assert.equal(maxHintsFor("Elefante"), 3); // 8 letters -> floor((8-1)/2) = 3
  assert.equal(maxHintsFor("Tortuga marina"), 6); // 13 letters (space excluded)
});

test("computeWordHint reveals nothing at 0 elapsed seconds and only spaces stay visible", () => {
  const word = "Oso polar";
  const order = buildHintOrder(word);
  assert.equal(computeWordHint(word, order, 0), "___ _____");
});

test("computeWordHint reveals more letters as elapsed time passes, capped at maxHintsFor", () => {
  const word = "Elefante";
  const order = buildHintOrder(word);
  const hintAt20s = computeWordHint(word, order, 20);
  const revealedAt20 = [...hintAt20s].filter(c => c !== "_").length;
  assert.equal(revealedAt20, 1);

  const hintAt1000s = computeWordHint(word, order, 1000);
  const revealedAtEnd = [...hintAt1000s].filter(c => c !== "_").length;
  assert.equal(revealedAtEnd, maxHintsFor(word));
  assert.ok(revealedAtEnd < word.length, "should never reveal the whole word automatically");
});

test("computeWordHint's revealed letters are always correct, never gibberish", () => {
  const word = "Camión";
  const order = buildHintOrder(word);
  const hint = computeWordHint(word, order, 40);
  for (let i = 0; i < word.length; i++) {
    if (hint[i] !== "_") assert.equal(hint[i], word[i]);
  }
});

test("popLastDrawUnit removes a whole gesture's chunks at once, matched by strokeId", () => {
  const strokes = [
    { type: "stroke", points: [[0, 0]], color: "#000", size: 4, strokeId: 1 },
    { type: "stroke", points: [[1, 1]], color: "#000", size: 4, strokeId: 1 },
    { type: "stroke", points: [[2, 2]], color: "#000", size: 4, strokeId: 2 },
  ];
  const result = popLastDrawUnit(strokes);
  assert.equal(result.length, 2);
  assert.ok(result.every((a: any) => a.strokeId === 1));
});

test("popLastDrawUnit removes just the single last action for a fill or clear", () => {
  const strokes = [
    { type: "stroke", points: [[0, 0]], color: "#000", size: 4, strokeId: 1 },
    { type: "fill", x: 5, y: 5, color: "#fff" },
  ];
  const result = popLastDrawUnit(strokes);
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "stroke");
});

test("popLastDrawUnit on an empty history is a no-op", () => {
  assert.deepEqual(popLastDrawUnit([]), []);
});
