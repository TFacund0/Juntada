// Shareable "scan and join" links: encode the room code (+ which game it is)
// as query params on the app's own URL, so scanning the QR just opens the
// app straight into the join screen with the code prefilled.
export function buildJoinUrl(gameId: string, code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("join", code);
  url.searchParams.set("game", gameId);
  return url.toString();
}

// Reads a join link's params (if present) and strips them from the visible
// URL so a later reload of the same tab doesn't re-trigger the join flow.
export function consumeJoinLink(): { code: string; gameId: string } | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("join");
  const gameId = params.get("game");
  if (!code || !gameId) return null;
  window.history.replaceState(null, "", window.location.pathname);
  return { code: code.toUpperCase(), gameId };
}
