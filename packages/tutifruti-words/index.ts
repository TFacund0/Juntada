// Word-normalization rules shared between the backend engine (which decides
// whether an answer actually counts) and the frontend RoundView (which
// previews the same "wrong letter" flag live, before the backend confirms
// it during review) — both sides need to agree on what counts as a match.
export function normalizeWord(word: string | undefined): string {
  return (word || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function startsWithLetter(word: string, letter: string): boolean {
  const w = normalizeWord(word);
  return !w || w.startsWith(normalizeWord(letter));
}
