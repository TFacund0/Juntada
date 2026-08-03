import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { buildPath } from "./appRoutes";

/**
 * Keeps the address bar in sync with useAppNavigation's step state, and
 * stops the browser's back/forward from silently dropping progress mid-round.
 *
 * Ordinary step changes (state → URL) always use a `replace`, never a
 * `push` — that's what makes the current screen reflect/refresh/share
 * correctly without turning the browser's back button into a multi-step
 * undo through every screen the player passed through. But that also means
 * this app's own history normally sits on a single entry: with nothing but
 * replaces, there is no same-document entry left for a back gesture to land
 * on, so it doesn't step backward through the app at all — it leaves it
 * outright (whatever the tab had open before), which a plain popstate
 * listener can't intercept (that's a different-document navigation, no
 * popstate fires for it at all).
 *
 * So the moment `midRound` turns true, this pushes one extra "checkpoint"
 * entry (same URL, just a real push instead of a replace) purely so there's
 * something for a back gesture to land on inside this document. From then
 * on a stray "back" fires an ordinary popstate here, which this listener
 * catches: it pushes the correct URL right back on top (undoing the pop)
 * and runs the same `goBack` a "Volver" tap would, reusing its existing
 * confirmation dialogs instead of inventing a new one.
 *
 * `midRound`/`goBack` are passed in rather than recomputed here so this hook
 * doesn't need to know anything about groups/rooms/local matches — just
 * "is there something a stray back shouldn't drop" and "what to do about it".
 */
export function useUrlSync(
  gameId: string | null,
  mode: "local" | "multi" | null,
  groupFlow: boolean,
  roomCode: string | null,
  groupCode: string | null,
  midRound: boolean,
  goBack: () => void,
) {
  const navigate = useNavigate();
  const location = useLocation();

  // Mirrors whatever the effect below last considered "correct", so the
  // checkpoint push and the popstate listener can both restore it without
  // recomputing anything themselves.
  const expectedPathRef = useRef<string>(buildPath(gameId, mode, groupFlow, roomCode, groupCode));
  useEffect(() => {
    const path = buildPath(gameId, mode, groupFlow, roomCode, groupCode);
    expectedPathRef.current = path;
    if (path !== location.pathname) navigate(path, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode, groupFlow, roomCode, groupCode]);

  // Pushes the checkpoint entry described above the first time midRound ever
  // turns true — not tied to the path-sync effect above, since midRound can
  // flip true without the path itself changing (e.g. an online room's phase
  // moving from "lobby" to an actual round doesn't change /room/:gameId/:code
  // at all).
  //
  // This only ever fires once per mount, not once per round: the popstate
  // listener below already re-pushes the same checkpoint on top of history
  // every time a stray back gesture consumes it while midRound is true, so
  // that one entry keeps the "something to land on" layer alive indefinitely
  // on its own. Re-pushing on every false→true cycle (leaving then re-
  // entering a round) used to stack a fresh, never-consumed entry each time
  // instead, so a player who played several rounds needed one "back" tap per
  // round just to leave the app.
  const hadCheckpointRef = useRef(false);
  useEffect(() => {
    if (midRound && !hadCheckpointRef.current) {
      navigate(expectedPathRef.current, { replace: false });
      hadCheckpointRef.current = true;
    }
  }, [midRound, navigate]);

  // Recomputed every render (not a dep array) so the popstate listener below
  // always reads the latest values through the refs, never a stale closure.
  const midRoundRef = useRef(midRound);
  const goBackRef = useRef(goBack);
  useEffect(() => {
    midRoundRef.current = midRound;
    goBackRef.current = goBack;
  });

  // The browser's back/forward buttons (or a phone's back gesture) fire a
  // native "popstate" the moment the address bar's entry actually changes —
  // by then the navigation already happened, there's no way to preventDefault
  // it. So instead of trying to block it, this pushes the correct URL right
  // back on top of history (a plain push, which — unlike history.forward()
  // — doesn't itself trigger another popstate, so there's no bounce/loop),
  // then runs goBack() exactly as a "Volver" tap would.
  useEffect(() => {
    const onPopState = () => {
      if (!midRoundRef.current) return;
      navigate(expectedPathRef.current, { replace: false });
      goBackRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigate]);
}
