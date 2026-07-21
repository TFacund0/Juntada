// Word-normalization rules shared between the backend engine (which decides
// whether an answer actually counts) and the frontend RoundView (which
// previews the same "wrong letter" flag live, before the backend confirms
// it during review) — both sides need to agree on what counts as a match.
// "ñ" is its own letter in Spanish, not an accented "n" — NFD-decomposing it
// (as the accent-stripping below does for á/é/...) turns it into "n" plus a
// combining tilde, and stripping that combining mark would then make "ñ" and
// "n" indistinguishable (e.g. "Nube" would wrongly count as starting with
// "Ñ"). Swap it out for a sentinel before normalizing so it survives intact.
const N_TILDE_SENTINEL = "";

export function normalizeWord(word: string | undefined): string {
  return (word || "")
    .trim()
    .toLowerCase()
    .replace(/ñ/g, N_TILDE_SENTINEL)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(new RegExp(N_TILDE_SENTINEL, "g"), "ñ");
}

export function startsWithLetter(word: string, letter: string): boolean {
  // A genuinely empty word (nothing typed yet) isn't wrong, just incomplete
  // — the caller decides separately whether a blank answer counts (see
  // engine.ts's finishRound, which never even calls this for one). But a
  // *non-empty* raw string that normalizes to nothing — e.g. a lone
  // combining accent typed via IME — isn't a real word either, and treating
  // that as an automatic match would let clearly-invalid input pass the
  // letter check and still score points.
  if (!word.trim()) return true;
  const w = normalizeWord(word);
  return !!w && w.startsWith(normalizeWord(letter));
}
