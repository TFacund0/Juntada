import { useEffect, useRef } from "react";
import { useNavigate, useLocation, useBlocker } from "react-router-dom";
import { buildPath } from "../../routing/appRoutes";

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
 *
 * The checkpoint push above is still required with useBlocker: a blocker
 * only intercepts a POP that actually lands on a same-document history
 * entry. With nothing but replaces, there is no such entry for it to catch
 * — so deleting the checkpoint push here would silently break the whole
 * guard, not just make it redundant.
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

  // Path this hook itself just told the router to navigate to, so the
  // blocker effect below can tell "our own outgoing navigate just got
  // blocked" apart from "the user actually pressed back" — see there for
  // why that distinction matters. Cleared once `location` catches up
  // (successful navigate) so a later, unrelated stray back to a
  // coincidentally-identical path isn't misread as our own.
  const selfNavTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const path = buildPath(gameId, mode, groupFlow, roomCode, groupCode);
    expectedPathRef.current = path;
    if (path !== location.pathname) {
      selfNavTargetRef.current = path;
      navigate(path, { replace: true });
    } else {
      selfNavTargetRef.current = null;
    }
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

  // Recomputed every render (not a dep array) so the blocker effect below
  // always reads the latest goBack through the ref, never a stale closure.
  const goBackRef = useRef(goBack);
  useEffect(() => {
    goBackRef.current = goBack;
  });

  // Data-router equivalent of the old manual popstate listener: blocks a
  // same-document navigation (the checkpoint entry's POP, per the comment
  // above) while midRound is true, runs goBack() exactly as a "Volver" tap
  // would, then resets the blocker — which restores the location it was
  // blocking at, replacing the old manual re-push of expectedPathRef.
  //
  // react-router re-registers this blocker's condition in its OWN effect,
  // which can run one tick after the path-sync effect above already fired a
  // `navigate(path, { replace: true })` in the same commit (ej. goHome
  // resetting mid-round state straight back to "/"). That leaves the
  // blocker still holding last render's "block everything" condition when
  // it intercepts our own outgoing navigation — not a stray user back
  // gesture. A real stray back always pops onto the checkpoint entry, which
  // shares its URL with the current path, so the blocked target can't be
  // told apart from our own navigate by path alone — only `selfNavTargetRef`
  // (set exclusively when THIS hook just issued that exact navigate) tells
  // the two apart. Only then let it through; otherwise it's a genuine stray
  // back and goBack() still runs as before.
  const blocker = useBlocker(midRound);
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (selfNavTargetRef.current !== null && blocker.location.pathname === selfNavTargetRef.current) {
      selfNavTargetRef.current = null;
      blocker.proceed();
      return;
    }
    goBackRef.current();
    blocker.reset();
  }, [blocker]);
}
