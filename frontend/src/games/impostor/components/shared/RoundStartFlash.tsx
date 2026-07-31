import { BigTextFlash } from "./BigTextFlash";

// Bridges into a fresh round of reveals — see BigTextFlash for the shared
// shell/animation. Different copy/palette from VoteResultsFlash on purpose,
// so the two moments read as distinct beats rather than the same overlay
// reused verbatim.
export function RoundStartFlash({ matchRound }: { matchRound: number }) {
  return <BigTextFlash eyebrow={`Ronda ${matchRound}`} text="¡A revelar cartas!" />;
}
