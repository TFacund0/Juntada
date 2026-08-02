// Shared "pop in, staggered" entrance for a grid of cards (players, suspects
// — anything rendered as a `.map` of similar tiles). Apply the
// `impostor-stagger-pop` class plus an inline `animationDelay: \`${i * 0.04}s\`
// per item so a whole grid doesn't pop in as one flat block. Originally
// local-only (ClueReadyScreen's player roster); reused by online's
// VotingPhaseScreen suspect grid too instead of each screen keeping its own
// copy of the same three lines of CSS.
export const staggerPopStyle = `
  .impostor-stagger-pop {
    animation: impostor-stagger-pop 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  @keyframes impostor-stagger-pop {
    from { opacity: 0; transform: scale(0.92) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
`;
