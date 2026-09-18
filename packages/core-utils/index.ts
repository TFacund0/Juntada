// Small, generic helpers shared across the app that aren't specific to any
// one game's rules — unlike the other packages/*, which each hold one
// game's own logic (@juntada/recamara-engine, etc). Kept separate from
// those so a change here can't be mistaken for a game-rule change.

// Fisher-Yates — used wherever something needs a fair random order (turn
// order, word pools, wheel entries, deck order). Was previously duplicated
// verbatim in backend/src/utils/shuffle.ts and frontend/src/utils/shuffle.ts;
// one copy here means a fix/change can't silently apply to only one side.
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Escapes user-controlled text (player names, chat) before it's interpolated
// into an HTML string that gets rendered via dangerouslySetInnerHTML — those
// spots build markup like `<b>${name}</b>` for emphasis, so the value itself
// still needs escaping or a player name like `<img onerror=...>` executes.
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
