// URL shape for the app's top-level navigation state (see useAppNavigation).
// Kept as pure functions, separate from the hook, so the path scheme is
// defined in exactly one place shared by both directions of the sync:
// parseRoute reads it back on a fresh load (direct URL entry/refresh),
// buildPath is what useAppNavigation's sync effect writes on every change.
//
//   /                      home (no game picked)
//   /game/:gameId          game picked, no mode yet (or local-only game)
//   /game/:gameId/local    playing that game in local mode
//   /room/:gameId          online room for that game, code not known yet
//   /room/:gameId/:code    same, once the server assigns/confirms a code
//   /group                 group flow, no code known yet
//   /group/:code           same, once the server assigns/confirms a code
export interface ParsedRoute {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  code: string | null;
}

export function parseRoute(pathname: string): ParsedRoute {
  // A trailing slash (hand-edited URL, some proxy/middleware normalizing it
  // in) isn't a path this scheme ever produces itself (buildPath never
  // appends one) but none of the regexes below tolerate it either — every
  // one of them anchors on `$` right after the last segment, so e.g.
  // "/room/impostor/" silently fell through to the `home` fallback instead
  // of being treated the same as "/room/impostor".
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  const localMatch = path.match(/^\/game\/([^/]+)\/local$/);
  if (localMatch) return { gameId: localMatch[1], mode: "local", groupFlow: false, code: null };

  const gameMatch = path.match(/^\/game\/([^/]+)$/);
  if (gameMatch) return { gameId: gameMatch[1], mode: null, groupFlow: false, code: null };

  const roomMatch = path.match(/^\/room\/([^/]+)(?:\/([^/]+))?$/);
  if (roomMatch) return { gameId: roomMatch[1], mode: "multi", groupFlow: false, code: roomMatch[2] ?? null };

  const groupMatch = path.match(/^\/group(?:\/([^/]+))?$/);
  if (groupMatch) return { gameId: null, mode: "multi", groupFlow: true, code: groupMatch[1] ?? null };

  return { gameId: null, mode: null, groupFlow: false, code: null };
}

export function buildPath(
  gameId: string | null,
  mode: "local" | "multi" | null,
  groupFlow: boolean,
  roomCode: string | null,
  groupCode: string | null,
): string {
  if (groupFlow) return groupCode ? `/group/${groupCode}` : "/group";
  if (mode === "multi" && gameId) return roomCode ? `/room/${gameId}/${roomCode}` : `/room/${gameId}`;
  if (mode === "local" && gameId) return `/game/${gameId}/local`;
  if (gameId) return `/game/${gameId}`;
  return "/";
}
