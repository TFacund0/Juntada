import type { UIMatch } from "react-router-dom";

// URL shape for the app's top-level navigation state (see useAppNavigation).
// Kept as pure functions/data, separate from the hook, so the path scheme is
// defined in exactly one place shared by both directions of the sync:
// routeInitFromMatches reads it back on a fresh load (direct URL entry/
// refresh), buildPath is what useAppNavigation's sync effect writes on every
// change. ROUTES itself is also the single source of truth for the route
// tree built in routes.tsx.
//
//   /                      home (no game picked)
//   /game/:gameId          game picked, no mode yet (or local-only game)
//   /game/:gameId/local    playing that game in local mode
//   /room/:gameId          online room for that game, code not known yet
//   /room/:gameId/:code    same, once the server assigns/confirms a code
//   /group                 group flow, no code known yet
//   /group/:code           same, once the server assigns/confirms a code
//   /join/:code            one-shot join link landing spot (see JoinRedirect)
export interface ParsedRoute {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  code: string | null;
}

export type RouteId = "home" | "game" | "gameLocal" | "room" | "group" | "join";

export const ROUTES: Record<RouteId, string> = {
  home: "/",
  game: "/game/:gameId",
  gameLocal: "/game/:gameId/local",
  room: "/room/:gameId/:code?",
  group: "/group/:code?",
  join: "/join/:code",
};

// Reads the matched route's id (assigned as its route object's `id` in
// routes.tsx) off a useMatches() entry — react-router doesn't otherwise
// expose which entry in ROUTES a given match came from.
function matchRouteId(matches: UIMatch[]): RouteId | null {
  const leaf = matches[matches.length - 1];
  return (leaf?.id as RouteId | undefined) ?? null;
}

export function routeInitFromMatches(matches: UIMatch[]): ParsedRoute {
  const routeId = matchRouteId(matches);
  const leaf = matches[matches.length - 1];
  const params = (leaf?.params ?? {}) as Record<string, string | undefined>;

  switch (routeId) {
    case "gameLocal":
      return { gameId: params.gameId ?? null, mode: "local", groupFlow: false, code: null };
    case "game":
      return { gameId: params.gameId ?? null, mode: null, groupFlow: false, code: null };
    case "room":
      return { gameId: params.gameId ?? null, mode: "multi", groupFlow: false, code: params.code ?? null };
    case "group":
      return { gameId: null, mode: "multi", groupFlow: true, code: params.code ?? null };
    default:
      return { gameId: null, mode: null, groupFlow: false, code: null };
  }
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
