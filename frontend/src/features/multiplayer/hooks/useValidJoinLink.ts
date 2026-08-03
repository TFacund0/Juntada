import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getGame } from "../../../games/registry";
import { parseJoinLink, type JoinLink } from "../utils/joinLink";

// A join link pasted directly as ?join=CODE on the root URL (the shape this
// app used before /join/:code existed as a real route) — still handled here
// so an old bookmarked/shared link keeps working. A pure read, deliberately
// with no side effect: React 18's StrictMode calls a useState initializer
// twice in dev specifically to catch impure ones, and this used to also
// strip the query string right here — the second call then found nothing
// left to parse (the first call had just erased it), silently losing the
// link every time in dev. Clearing the URL now happens once in the mount
// effect below instead, where a duplicate StrictMode invocation is harmless.
function legacyQueryJoinLink(): JoinLink | null {
  const params = new URLSearchParams(window.location.search);
  return parseJoinLink(params.get("join"), params);
}

/**
 * Picks up, once, a pending "join" link — either handed down as router state
 * by the /join/:code route (JoinRedirect), or found directly in the current
 * URL's query string (legacy ?join=CODE links already shared/printed before
 * this app used a real route for them).
 *
 * A link always wins over a restored session: if the player scanned a QR or
 * followed a link explicitly, the intention is to go there, not back to
 * wherever they were before. Computed once (useState lazy initializer)
 * since it shouldn't re-run on every render. A group link carries no game —
 * the game is only known once the player picks (or joins) one from inside
 * the group.
 */
export function useValidJoinLink(): JoinLink | null {
  const location = useLocation();
  const [validJoinLink] = useState<JoinLink | null>(() => {
    const stateLink = (location.state as { joinLink?: JoinLink } | null)?.joinLink ?? null;
    const link = stateLink ?? legacyQueryJoinLink();
    if (!link) return null;
    if (link.kind === "room" && !getGame(link.gameId)) return null;
    return link;
  });

  // Strips a legacy ?join=... query string off the visible URL once it's
  // been picked up above — same purpose as the old consumeJoinLink's
  // history.replaceState, just moved out of the render-phase initializer
  // (see the comment on legacyQueryJoinLink for why it can't live there).
  useEffect(() => {
    if (validJoinLink && window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return validJoinLink;
}
