import { useState, useRef, useCallback, useEffect } from "react";
import { loadSession, saveSession, type RoomSession, type GroupSession, type PersistedSession } from "../services/multiplayerSession";

// Owns everything about "which session is persisted and does one exist right
// now" — split out of useMultiplayerSocket.ts (see design's ownership-split
// table: state + its mirroring refs travel together). Nothing here talks to
// the socket/service directly; useMultiplayerSocket wires this hook's
// outputs into the InboundMessageContext port and the service's
// getRejoinMessage/shouldReconnect getters.
export function useMultiplayerSession({ entryKind }: { entryKind?: "room" | "group" }) {
  const [me, setMe] = useState<RoomSession | null>(() => loadSession()?.room ?? null);
  const [groupMe, setGroupMe] = useState<GroupSession | null>(() => loadSession()?.group ?? null);

  // A persisted group session should only drive auto-rejoin behavior when
  // this screen was actually opened for the group flow — otherwise a stale
  // group session from a past visit races its own rejoin_group against this
  // screen's create_room/join_room on mount, and whichever socket loses gets
  // orphaned mid-handshake (surfaces as a bogus "No se pudo conectar al
  // servidor"). The session itself is still kept/persisted untouched so a
  // real group elsewhere isn't affected by visiting a standalone room.
  const groupSessionEnabled = entryKind !== "room";
  // Mirror image of groupSessionEnabled: a persisted room session shouldn't
  // drive auto-rejoin either when this screen was opened for the group flow
  // — otherwise tapping "Crear o unirme a un grupo" with an old standalone
  // room still in localStorage (tab closed mid-game instead of using
  // "Volver"/"Menú principal") silently rejoins that unrelated room instead
  // of showing the group create/join screen the player actually tapped into.
  const roomSessionEnabled = entryKind !== "group";
  // Mirrored into refs so stable-closure sites (readHasActiveSession, the
  // service's getRejoinMessage/shouldReconnect getters — captured once when
  // the service is created) always read the current entryKind-derived flags
  // instead of the ones from whichever render happened to be current at
  // construction time.
  const groupSessionEnabledRef = useRef(groupSessionEnabled);
  groupSessionEnabledRef.current = groupSessionEnabled;
  const roomSessionEnabledRef = useRef(roomSessionEnabled);
  roomSessionEnabledRef.current = roomSessionEnabled;

  const meRef = useRef(me);
  const groupMeRef = useRef(groupMe);

  // Snapshot of what was persisted at mount — used to tell whether a
  // group_joined/group_state during cold start should resolve immediately
  // (no room ever expected) or wait for the "joined"/"state" that a live
  // group instance sends right after (see useReconnectOverlay's
  // settleGroupColdStart).
  const initialSessionRef = useRef<PersistedSession | null>(loadSession());

  useEffect(() => {
    meRef.current = me;
    saveSession({ room: me ?? undefined, group: groupMeRef.current ?? undefined });
  }, [me]);
  useEffect(() => {
    groupMeRef.current = groupMe;
    saveSession({ room: meRef.current ?? undefined, group: groupMe ?? undefined });
  }, [groupMe]);

  const readMe = useCallback(() => meRef.current, []);
  const readGroupMe = useCallback(() => groupMeRef.current, []);
  const readGroupSessionEnabled = useCallback(() => groupSessionEnabledRef.current, []);

  // Single named predicate replacing the 3x-duplicated
  // `(roomSessionEnabled && me) || (groupSessionEnabled && groupMe)`
  // boolean expression. Internal only — never part of the composition
  // root's public return (see spec's "not part of the public 24-field
  // return" requirement).
  const hasActiveSession = Boolean((roomSessionEnabled && me) || (groupSessionEnabled && groupMe));

  // Ref-reading variant for stable-closure call sites (the service's
  // shouldReconnect getter, the mount auto-rejoin effect, the
  // visibilitychange/pageshow handler) that must always read the *current*
  // session/entryKind state despite being captured once or running outside
  // a render.
  const readHasActiveSession = useCallback(
    () => Boolean((roomSessionEnabledRef.current && meRef.current) || (groupSessionEnabledRef.current && groupMeRef.current)),
    [],
  );

  // Mount-snapshot version of hasActiveSession — "must mirror the auto-rejoin
  // effect's condition" is now a single shared derivation instead of a
  // comment repeated in three places.
  const [initialColdStart] = useState(() => {
    const s = initialSessionRef.current;
    return Boolean((roomSessionEnabled && s?.room) || (groupSessionEnabled && s?.group));
  });

  const getRejoinMessage = useCallback(() => {
    if (groupSessionEnabledRef.current && groupMeRef.current)
      return { type: "rejoin_group" as const, groupCode: groupMeRef.current.groupCode, playerId: groupMeRef.current.playerId };
    if (roomSessionEnabledRef.current && meRef.current)
      return { type: "rejoin" as const, roomCode: meRef.current.roomCode, playerId: meRef.current.playerId };
    return null;
  }, []);

  return {
    me,
    setMe,
    groupMe,
    setGroupMe,
    meRef,
    groupMeRef,
    groupSessionEnabled,
    roomSessionEnabled,
    initialSessionRef,
    readMe,
    readGroupMe,
    readGroupSessionEnabled,
    hasActiveSession,
    readHasActiveSession,
    initialColdStart,
    getRejoinMessage,
  };
}
