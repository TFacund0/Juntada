// Shareable "scan and join" links: encode a code (+ what kind of thing it
// is — a group, or a standalone room for a specific game) as a real route
// (/join/CODE) on the app's own URL, so scanning the QR opens the app
// straight into the join screen with the code prefilled, and the link is
// also a valid deep link on its own (react-router resolves /join/:code to
// JoinRedirect, which reads these same params).
//
// Two distinct kinds of link:
//   - group link: /join/CODE?kind=group           (no game — you pick once inside)
//   - room link:  /join/CODE?game=GAMEID           (standalone room, fixed game)
//
// A previous version of this app encoded the same info as query params on
// the root URL (?join=CODE&kind=group). Old QR codes already printed/shared
// before this change still carry that shape and will keep circulating
// indefinitely — extractScannedCode below must keep accepting both forms.

export function buildGroupJoinUrl(code: string): string {
  const url = new URL(`/join/${code}`, window.location.origin);
  url.searchParams.set("kind", "group");
  return url.toString();
}

export function buildRoomJoinUrl(gameId: string, code: string): string {
  const url = new URL(`/join/${code}`, window.location.origin);
  url.searchParams.set("game", gameId);
  return url.toString();
}

export type JoinLink = { code: string; kind: "group" } | { code: string; kind: "room"; gameId: string };

// Parses a join link's code + kind/game out of a path + query string —
// shared by the /join/:code route (JoinRedirect) and by the legacy
// ?join=CODE fallback still handled at the home route.
export function parseJoinLink(code: string | null | undefined, params: URLSearchParams): JoinLink | null {
  if (!code) return null;
  const kind = params.get("kind");
  const gameId = params.get("game");
  if (kind === "group" || !gameId) return { code: code.toUpperCase(), kind: "group" };
  return { code: code.toUpperCase(), kind: "room", gameId };
}

// Pulls just the room/group code out of whatever the in-app QR scanner
// decoded — one of this app's own join links (new /join/CODE path, or the
// legacy ?join=CODE query param), or a bare code if the QR only ever encoded
// that. Doesn't need to resolve "room" vs "group": the join screen's own
// check_room_code preview already handles a code that turns out to be the
// other kind (see MultiplayerGame's "Unirme al grupo" fallback), so there's
// nothing extra to decide here.
//
// Only recognizes the /join/... and ?join=... shapes on this app's own
// origin — a QR from a different site whose URL happens to contain a
// same-looking path/param shouldn't be treated as one of ours. A bare code
// (no URL at all) has no origin to check, so it's still accepted as-is.
export function extractScannedCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.origin === window.location.origin) {
      const pathMatch = url.pathname.match(/\/join\/([A-Za-z0-9]{1,8})$/);
      if (pathMatch) return pathMatch[1].toUpperCase();
      const legacyCode = url.searchParams.get("join");
      if (legacyCode) return legacyCode.toUpperCase();
    }
    return null;
  } catch {
    /* not a URL — fall through to the bare-code case below */
  }

  return /^[A-Za-z0-9]{1,8}$/.test(trimmed) ? trimmed.toUpperCase() : null;
}
