// Shareable "scan and join" links: encode a code (+ what kind of thing it
// is — a group, or a standalone room for a specific game) as query params
// on the app's own URL, so scanning the QR just opens the app straight into
// the join screen with the code prefilled.
//
// Two distinct kinds of link:
//   - group link: ?join=CODE&kind=group           (no game — you pick once inside)
//   - room link:  ?join=CODE&game=GAMEID           (standalone room, fixed game)

export function buildGroupJoinUrl(code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("join", code);
  url.searchParams.set("kind", "group");
  return url.toString();
}

export function buildRoomJoinUrl(gameId: string, code: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("join", code);
  url.searchParams.set("game", gameId);
  return url.toString();
}

export type JoinLink = { code: string; kind: "group" } | { code: string; kind: "room"; gameId: string };

// Reads a join link's params (if present) and strips them from the visible
// URL so a later reload of the same tab doesn't re-trigger the join flow.
export function consumeJoinLink(): JoinLink | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("join");
  if (!code) return null;
  const kind = params.get("kind");
  const gameId = params.get("game");
  window.history.replaceState(null, "", window.location.pathname);
  if (kind === "group" || !gameId) return { code: code.toUpperCase(), kind: "group" };
  return { code: code.toUpperCase(), kind: "room", gameId };
}

// Pulls just the room/group code out of whatever the in-app QR scanner
// decoded — one of this app's own join links (?join=CODE&...), or a bare
// code if the QR only ever encoded that. Doesn't need to resolve "room" vs
// "group": the join screen's own check_room_code preview already handles a
// code that turns out to be the other kind (see MultiplayerGame's
// "Unirme al grupo" fallback), so there's nothing extra to decide here.
export function extractScannedCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const code = new URL(trimmed).searchParams.get("join");
    if (code) return code.toUpperCase();
  } catch {
    /* not a URL — fall through to the bare-code case below */
  }

  return /^[A-Za-z0-9]{1,8}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}
