import { useState, useRef, useCallback, useEffect } from "react";
import type { ClientMessage, RoomPublicState, GroupPublicState, ErrorCode } from "@juntada/shared-types";
import { useFlashError } from "../../../hooks/useFlashError";

// What SessionRecoveryOverlay should show, if anything — computed from the
// half-dozen underlying flags below so MultiplayerGame doesn't have to
// re-derive "which one wins" itself; the hook is the single source of truth
// for what's actually going on with the connection.
export type OverlayMode = "none" | "connecting" | "prompt" | "reconnected" | "failed" | "gone";

// In dev, Vite (5173) and the backend (3001) run as separate servers, so the
// socket has to point at the backend explicitly. In production a single
// server serves the built frontend and the WS endpoint from the same origin.
const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:${import.meta.env.VITE_BACKEND_PORT || 3001}`
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

// Stops the automatic retry loop after this many failed attempts so a
// truly-gone connection doesn't retry silently forever — the UI offers a
// manual "reintentar"/"volver al menú" choice once this is hit instead.
const MAX_RECONNECT_ATTEMPTS = 10;
// Backoff between retries: starts at 3s, grows by 600ms per attempt, caps
// at 8s — gentler on a flaky connection (and the server) than hammering
// every 3s indefinitely, while still recovering quickly from a brief drop.
function reconnectDelayMs(attempt: number): number {
  return Math.min(3000 + (attempt - 1) * 600, 8000);
}

// The backend already pings every 30s and terminates sockets that don't
// pong back (see backend/src/ws/server.ts's HEARTBEAT_INTERVAL_MS) — but
// that's a protocol-level ping/pong the browser answers automatically
// without ever surfacing it to this hook's onmessage. So when the far end
// vanishes without a clean TCP close (phone loses signal mid-session, wifi
// drops instantly), the client's readyState keeps reporting OPEN forever:
// no onclose ever fires, so the reconnect loop below never kicks in and the
// player is stuck until they manually reload. This app-level watchdog is
// what actually notices — see the setInterval near the bottom of the hook.
const WATCHDOG_CHECK_MS = 10_000;
// Send our own {type:"ping"} once the server's gone quiet this long — well
// past a normal lull between broadcasts, short enough to catch a dead
// connection quickly.
const PING_AFTER_IDLE_MS = 15_000;
// No message at all (not even our own ping's "pong" reply) for this long
// means the socket is lying about being OPEN — force-close it so the
// existing onclose reconnect flow takes over.
const WATCHDOG_DEAD_MS = 35_000;

// How long to wait, after a group_joined/group_state during a group-attached
// cold start, for the "joined" that only arrives if the persisted instance
// is still live — see settleGroupColdStart below.
const GROUP_JOINED_FALLBACK_MS = 1_500;

// Backgrounding the tab on mobile (switching to WhatsApp, locking the screen,
// etc.) can kill the socket or even discard the JS context entirely. We
// persist just enough identity to rejoin the same room/group after either
// case — the server already keeps a disconnected player's slot reserved
// (marked offline, not removed) for a grace period, so this is what lets the
// client actually make use of that instead of dumping the player back at the
// menu.
//
// A client can be:
//   - standalone-room-attached only: room session, no group session.
//   - group-attached, no active instance: group session, no room session.
//   - group-attached with an active instance: both sessions set, same playerId.
const SESSION_KEY = "impostorgame:session";

interface RoomSession {
  playerId: string;
  roomCode: string;
}

// Result of the join screen's live "check_room_code" lookup — see roomPreview.
export interface RoomPreview {
  code: string;
  found: boolean;
  name?: string;
  gameType?: string;
  isGroupCode?: boolean;
}

interface GroupSession {
  playerId: string;
  groupCode: string;
}

interface PersistedSession {
  room?: RoomSession;
  group?: GroupSession;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession | null): void {
  try {
    if (session && (session.room || session.group)) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable (private mode, etc.) — degrade silently */
  }
}

// Exposed so the root app can drop a persisted session when the player
// deliberately navigates away (back to menu, picks a different game), rather
// than leaving it around to be wrongly auto-rejoined on a later visit.
export function clearMultiplayerSession(): void {
  saveSession(null);
}

// The server messages this hook reacts to (see backend/src/ws/messaging.ts
// and each engine's getRevealMessage) — private_role and word_reveal payload
// shapes are per-engine, not yet a clean discriminated union (see
// @juntada/shared-types's ServerMessage comment), so they stay loose here too.
type InboundMessage =
  | { type: "joined"; playerId: string; roomCode: string; room: RoomPublicState }
  | { type: "state"; room: RoomPublicState }
  | { type: "group_joined"; playerId: string; groupCode: string; group: GroupPublicState }
  | { type: "group_state"; group: GroupPublicState }
  | { type: "left_instance" }
  | { type: "left_group" }
  | { type: "private_role"; [key: string]: unknown }
  | { type: "word_reveal"; [key: string]: unknown }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "kicked" }
  | { type: "kicked_from_group" }
  | { type: "room_preview"; code: string; found: boolean; name?: string; gameType?: string; isGroupCode?: boolean };

// Encapsulates the WebSocket connection lifecycle (connect, reconnect/rejoin,
// message dispatch) so the UI component only deals with plain state.
// `onLeftGroup` fires once, right when a `left_group` confirmation comes in
// — the caller (MultiplayerGame) uses it to tell App.tsx to leave the whole
// group flow, since "menu" alone doesn't distinguish that from the very
// first screen before ever joining anything.
//
// MAPA DEL ARCHIVO (en orden de aparición dentro de la función):
//   1. useState/useRef iniciales      — connectionPhase, me/room, group,
//                                       roomPreview, banderas de reconexión.
//   2. flashError/clearError          — el mensaje de error temporal (usa
//                                       hooks/useFlashError.ts compartido).
//   3. onReconnected()                — qué hacer cuando un mensaje del
//                                       servidor confirma que la conexión
//                                       funciona de nuevo.
//   4. connect()                      — abre el WebSocket y define
//                                       ws.onopen/onmessage/onclose/onerror.
//                                       Es la función más larga: todo el
//                                       dispatch de mensajes entrantes
//                                       (joined/state/group_joined/error/...)
//                                       vive en su onmessage.
//   5. retryConnection()              — reintento manual tras agotar los
//                                       intentos automáticos.
//   6. Efectos de ciclo de vida       — auto-rejoin al montar, reconectar al
//                                       volver de background (visibilitychange/
//                                       pageshow), limpieza al desmontar.
//   7. send()/leave()                 — mandar un mensaje ya conectado, y
//                                       salir olvidando la sesión guardada.
//   8. return                         — todo el estado + funciones que
//                                       MultiplayerGame.tsx consume.
export function useMultiplayerSocket({ onLeftGroup, entryKind }: { onLeftGroup?: () => void; entryKind?: "room" | "group" } = {}) {
  // menu|create|join, then mirrors room.phase directly ("lobby" and whatever
  // in-game phases the active game defines — this hook doesn't know or care
  // what those are) once a room is attached, or "group" once a group is
  // attached with no active instance.
  const [connectionPhase, setConnectionPhase] = useState("menu");
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
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [group, setGroup] = useState<GroupPublicState | null>(null);
  const [myRole, setMyRole] = useState<Record<string, unknown> | null>(null); // { isImpostor, word, hint }
  const [wordReveal, setWordReveal] = useState<Record<string, unknown> | null>(null);
  // Result of the join screen's live "check_room_code" lookup — a read-only
  // preview of what a typed code points to, shown before the player commits
  // to actually joining (see MenuScreen's join-room form).
  const [roomPreview, setRoomPreview] = useState<RoomPreview | null>(null);
  // How long an error banner stays up before auto-clearing itself.
  const [error, errorKey, setErrorExternal] = useFlashError(5000);
  const flashError = setErrorExternal;
  const clearError = useCallback(() => setErrorExternal(""), [setErrorExternal]);
  // True while a dropped socket is being retried in the background (flaky
  // connection, tab was suspended, etc.) — lets the UI show a "reconectando"
  // banner instead of silently retrying with no feedback.
  const [reconnecting, setReconnecting] = useState(false);
  // How many attempts have been made since the socket last dropped — shown
  // in the UI so a long reconnect doesn't look frozen, and used to decide
  // when to give up (see MAX_RECONNECT_ATTEMPTS below).
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  // True once MAX_RECONNECT_ATTEMPTS is exhausted with no successful
  // reconnect — stops the retry loop and lets the UI offer a manual
  // "reintentar"/"volver al menú" choice instead of retrying forever
  // in silence.
  const [reconnectFailed, setReconnectFailed] = useState(false);
  // Briefly true right after a reconnect that followed a real drop (not the
  // very first connect) — lets the UI flash a "Reconectado" confirmation
  // instead of the banner just vanishing with no acknowledgment.
  const [justReconnected, setJustReconnected] = useState(false);
  // True from mount whenever a persisted session was found in localStorage,
  // until it's been resolved one way or another — drives the full-screen
  // "Autenticando sesión..." gate (SessionRecoveryOverlay) instead of letting
  // the player see the menu/lobby flash by underneath while the rejoin
  // round-trip is still in flight.
  const [coldStart, setColdStart] = useState(() => {
    const s = loadSession();
    // Must mirror the auto-rejoin effect's condition below: a persisted
    // group session only counts here if this screen actually cares about
    // group sessions (groupSessionEnabled). Otherwise a leftover group
    // session from a past visit sets coldStart=true but the mount effect
    // never calls connect() for it (entryKind "room" ignores group
    // sessions) — no socket ever opens, so nothing ever resolves coldStart
    // and the "Autenticando sesión" overlay hangs forever.
    return Boolean((roomSessionEnabled && s?.room) || (groupSessionEnabled && s?.group));
  });
  // True once the cold-start rejoin lands on an in-progress game — instead of
  // silently dropping the player back into the round, the overlay asks
  // explicitly ("Reconectar a la partida" / "Volver al menú principal") since
  // a stale tab jumping straight back into a live vote is more disorienting
  // than reassuring.
  const [rejoinChoicePending, setRejoinChoicePending] = useState(false);
  // True once a rejoin attempt (cold start or a live drop reconnecting mid-
  // game) comes back with REJOIN_FAILED/REJOIN_GROUP_FAILED — the room/group
  // itself is gone (host ended it, expired while this player was offline),
  // not just a flaky connection, so there's nothing left to retry. Drives
  // the overlay's "gone" mode: an explicit "esta sala ya no existe" screen
  // with only a way back to the menu, instead of silently dropping into the
  // join form with just an easy-to-miss toast.
  const [sessionGone, setSessionGone] = useState(false);
  const coldStartRef = useRef(coldStart);
  // Snapshot of what was persisted at mount — used to tell whether a
  // group_joined/group_state during cold start should resolve immediately
  // (no room ever expected) or wait for the "joined"/"state" that a live
  // group instance sends right after (see connect()'s onopen comment).
  const initialSessionRef = useRef(loadSession());
  // Fallback for a group-attached cold start: group_joined/group_state waits
  // for a "joined" that only arrives if the persisted instance is still
  // live (see the comment below). If it ended while this player was
  // offline, no "joined" ever comes — without this timeout the overlay
  // would sit on "Autenticando" forever instead of falling through to the
  // group screen.
  const groupJoinedFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    coldStartRef.current = coldStart;
  }, [coldStart]);
  // Timestamp of the last message received from the server (any type,
  // including the "pong" reply to our own watchdog ping below) — read by the
  // watchdog interval to notice a half-open connection.
  const lastMessageAtRef = useRef(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectedBannerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meRef = useRef(me);
  const groupMeRef = useRef(groupMe);
  const roomRef = useRef<RoomPublicState | null>(null);
  const reconnectingRef = useRef(false);
  const onLeftGroupRef = useRef(onLeftGroup);
  onLeftGroupRef.current = onLeftGroup;

  useEffect(() => {
    meRef.current = me;
    saveSession({ room: me ?? undefined, group: groupMeRef.current ?? undefined });
  }, [me]);
  useEffect(() => {
    groupMeRef.current = groupMe;
    saveSession({ room: meRef.current ?? undefined, group: groupMe ?? undefined });
  }, [groupMe]);
  useEffect(() => {
    roomRef.current = room;
  }, [room]);
  useEffect(() => {
    reconnectingRef.current = reconnecting;
  }, [reconnecting]);

  // Called on any message that confirms the connection is actually working
  // again (joined/state/group_joined/group_state/kicked all count — a
  // response of any kind proves the round trip works). Only flashes the
  // "Reconectado" confirmation if we were actually mid-reconnect, not on
  // the very first connect of a session.
  const onReconnected = useCallback(() => {
    if (reconnectingRef.current) {
      setJustReconnected(true);
      if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
      reconnectedBannerRef.current = setTimeout(() => setJustReconnected(false), 3000);
    }
    setReconnecting(false);
    setReconnectAttempt(0);
    setReconnectFailed(false);
  }, []);

  // Called whenever a message arrives that could settle the cold-start gate.
  // `phase` is the room phase this message carries, if any — "lobby" (or no
  // room at all) resolves immediately since there's nothing mid-game to ask
  // about; anything else means a live round, so it waits for an explicit
  // choice instead.
  const resolveColdStart = useCallback((phase?: string) => {
    if (!coldStartRef.current) return;
    if (phase && phase !== "lobby") setRejoinChoicePending(true);
    else setColdStart(false);
  }, []);

  // Shared by both group_joined and group_state below (see GROUP_JOINED_FALLBACK_MS):
  // a persisted room session means a "joined" for the live instance is
  // expected right after either message — wait for that instead of
  // resolving the cold-start gate now and having it flicker away then back.
  // But that instance may have ended while this player was offline, in
  // which case no "joined" is ever coming, so a timeout is the only way out.
  const settleGroupColdStart = useCallback(() => {
    if (!initialSessionRef.current?.room) {
      resolveColdStart();
      return;
    }
    if (!coldStartRef.current) return;
    if (groupJoinedFallbackRef.current) clearTimeout(groupJoinedFallbackRef.current);
    groupJoinedFallbackRef.current = setTimeout(() => {
      if (!roomRef.current) resolveColdStart();
    }, GROUP_JOINED_FALLBACK_MS);
  }, [resolveColdStart]);

  const connect = useCallback(
    (onOpen?: (ws: WebSocket) => void) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        onOpen?.(wsRef.current);
        return;
      }
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => {
        lastMessageAtRef.current = Date.now();
        if (onOpen) onOpen(ws);
        else if (groupSessionEnabled && groupMeRef.current)
          ws.send(JSON.stringify({ type: "rejoin_group", groupCode: groupMeRef.current.groupCode, playerId: groupMeRef.current.playerId }));
        else if (roomSessionEnabled && meRef.current)
          ws.send(JSON.stringify({ type: "rejoin", roomCode: meRef.current.roomCode, playerId: meRef.current.playerId }));
      };
      ws.onmessage = e => {
        lastMessageAtRef.current = Date.now();
        let msg: InboundMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg.type === "joined") {
          if (groupJoinedFallbackRef.current) {
            clearTimeout(groupJoinedFallbackRef.current);
            groupJoinedFallbackRef.current = null;
          }
          setMe({ playerId: msg.playerId, roomCode: msg.roomCode });
          setRoom(msg.room);
          setConnectionPhase(msg.room.phase);
          clearError();
          onReconnected();
          resolveColdStart(msg.room.phase);
        } else if (msg.type === "state") {
          setRoom(msg.room);
          setConnectionPhase(msg.room.phase);
          clearError();
          onReconnected();
          resolveColdStart(msg.room.phase);
        } else if (msg.type === "group_joined") {
          setGroupMe({ playerId: msg.playerId, groupCode: msg.groupCode });
          setGroup(msg.group);
          // A rejoin_group may be immediately followed by a "joined" for a
          // still-live instance — don't force the group screen if that's
          // about to happen; only switch phase here if we're not already
          // sitting on a room (a plain group_state update from the group
          // screen itself takes this branch too, harmlessly).
          setRoom(prevRoom => {
            if (!prevRoom) setConnectionPhase("group");
            return prevRoom;
          });
          clearError();
          onReconnected();
          settleGroupColdStart();
        } else if (msg.type === "group_state") {
          setGroup(msg.group);
          clearError();
          onReconnected();
          settleGroupColdStart();
        } else if (msg.type === "left_instance") {
          setMe(null);
          setRoom(null);
          setMyRole(null);
          setWordReveal(null);
          setConnectionPhase("group");
          clearError();
        } else if (msg.type === "left_group") {
          setMe(null);
          setRoom(null);
          setGroupMe(null);
          setGroup(null);
          setMyRole(null);
          setWordReveal(null);
          setConnectionPhase("menu");
          clearError();
          onLeftGroupRef.current?.();
        } else if (msg.type === "private_role") {
          setMyRole(msg);
          setWordReveal(null);
        } else if (msg.type === "word_reveal") {
          setWordReveal(msg);
        } else if (msg.type === "error") {
          flashError(msg.message);
          if (msg.code === "REJOIN_FAILED" || msg.code === "REJOIN_GROUP_FAILED") {
            // The room/group this session pointed at is gone — not a flaky
            // connection, nothing left to retry. Covers both a cold start
            // (reload after the host ended the game) and a live drop that
            // reconnects into a room that ended while this player was
            // offline. Deliberately doesn't clear me/groupMe here (that's
            // what tells the "gone" overlay whether to say "sala" or
            // "grupo") — the actual session/localStorage cleanup happens
            // once the player dismisses it via leave().
            setReconnecting(false);
            setReconnectAttempt(0);
            setReconnectFailed(false);
            setRejoinChoicePending(false);
            setSessionGone(true);
          } else if (!roomRef.current && !groupMeRef.current) {
            // Failed before ever landing in a room/group — a fresh join
            // with a bad code, typed by the user on the join screen. Never
            // leave the UI stuck: drop the stale session and send them back
            // to the menu instead of an infinite "Conectando..." with
            // nothing to rejoin.
            setMe(null);
            setRoom(null);
            setConnectionPhase(prev => (prev === "menu" || prev === "create" || prev === "join" ? prev : "join"));
            setColdStart(false);
          } else {
            setColdStart(false);
          }
        } else if (msg.type === "room_preview") {
          setRoomPreview(msg);
        } else if (msg.type === "kicked") {
          setConnectionPhase(groupMeRef.current ? "group" : "menu");
          setMe(null);
          setRoom(null);
          setMyRole(null);
          flashError("Fuiste expulsado de la sala");
          setReconnecting(false);
          setColdStart(false);
        } else if (msg.type === "kicked_from_group") {
          setMe(null);
          setRoom(null);
          setGroupMe(null);
          setGroup(null);
          setMyRole(null);
          setWordReveal(null);
          setConnectionPhase("menu");
          flashError("Fuiste expulsado del grupo");
          setReconnecting(false);
          onLeftGroupRef.current?.();
          setColdStart(false);
        }
      };
      ws.onclose = () => {
        if (!(roomSessionEnabled && meRef.current) && !(groupSessionEnabled && groupMeRef.current)) return;
        setReconnecting(true);
        // A fresh drop mid-retry-loop shouldn't still show a stale
        // "Reconectado" from an earlier, unrelated recovery.
        setJustReconnected(false);
        if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
        setReconnectAttempt(prevAttempt => {
          const attempt = prevAttempt + 1;
          if (attempt > MAX_RECONNECT_ATTEMPTS) {
            setReconnecting(false);
            setReconnectFailed(true);
            return prevAttempt;
          }
          reconnectRef.current = setTimeout(() => {
            if ((roomSessionEnabled && meRef.current) || (groupSessionEnabled && groupMeRef.current)) connect();
          }, reconnectDelayMs(attempt));
          return attempt;
        });
      };
      ws.onerror = () => flashError("No se pudo conectar al servidor");
    },
    [onReconnected, flashError, clearError, groupSessionEnabled, roomSessionEnabled, resolveColdStart, settleGroupColdStart],
  );

  // Manual retry after the automatic loop gave up (see reconnectFailed) —
  // resets the attempt count/backoff so the player gets a fresh full run
  // of retries rather than picking up where the exhausted loop left off.
  //
  // setReconnecting(true) here is optimistic: `connect()` only flips it
  // (via ws.onclose) once the *new* socket itself drops, so without this
  // there was a gap — reconnectFailed already false, reconnecting still
  // false — where overlayMode fell through to "none", unmounting the gate
  // and flashing the game underneath for a frame before the socket's first
  // event brought "Autenticando" back. onReconnected() clears it the moment
  // this attempt actually lands, same as every other path into "connecting".
  const retryConnection = useCallback(() => {
    setReconnectFailed(false);
    setReconnectAttempt(0);
    setReconnecting(true);
    connect();
  }, [connect]);

  // Auto-rejoin a persisted session on mount (covers the case where the
  // mobile browser fully discarded the page while backgrounded, so the app
  // remounted from scratch instead of just dropping the socket).
  useEffect(() => {
    if ((roomSessionEnabled && meRef.current) || (groupSessionEnabled && groupMeRef.current)) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // See WATCHDOG_DEAD_MS above: readyState alone can't tell a healthy socket
  // from a half-open one where the far end vanished without a clean close.
  // This periodically pokes the connection with our own app-level ping once
  // it's gone quiet, and force-closes it if even that gets no reply — which
  // hands off to the existing onclose reconnect loop instead of leaving the
  // player stuck on a screen that looks connected but never updates again.
  useEffect(() => {
    const id = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const idleMs = Date.now() - lastMessageAtRef.current;
      if (idleMs > WATCHDOG_DEAD_MS) ws.close();
      else if (idleMs > PING_AFTER_IDLE_MS) {
        try {
          ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          /* socket not actually writable — the close above will catch it next tick */
        }
      }
    }, WATCHDOG_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  // Timers/sockets get throttled or suspended while a mobile tab is in the
  // background. Rather than waiting for the passive onclose+3s retry (which
  // may be delayed well past when the user actually comes back), proactively
  // check the connection the moment the tab becomes visible again — and
  // don't just trust a stale-looking OPEN readyState either (see the
  // watchdog above), since a phone that lost signal while backgrounded is
  // exactly the case this needs to catch.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState !== "visible" ||
        (!(roomSessionEnabled && meRef.current) && !(groupSessionEnabled && groupMeRef.current))
      )
        return;
      const ws = wsRef.current;
      const stale = ws?.readyState === WebSocket.OPEN && Date.now() - lastMessageAtRef.current > PING_AFTER_IDLE_MS;
      if (ws?.readyState !== WebSocket.OPEN) {
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        // Same optimistic flag as retryConnection: if the socket died while
        // the tab was backgrounded but its throttled onclose hasn't actually
        // fired yet, reconnecting is still false here — without this, the
        // overlay would briefly drop (overlayMode falls through to "none")
        // right as the player switches back, flashing the stale game screen
        // for a frame before onclose/onReconnected catches up.
        setReconnecting(true);
        connect();
      } else if (stale) {
        ws.close();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [connect, groupSessionEnabled, roomSessionEnabled]);

  useEffect(
    () => () => {
      wsRef.current?.close();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
      if (groupJoinedFallbackRef.current) clearTimeout(groupJoinedFallbackRef.current);
    },
    [],
  );

  const send = useCallback(
    (msg: ClientMessage | Record<string, unknown>) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
      else flashError("Sin conexión con el servidor");
    },
    [flashError],
  );

  // Explicit leave (kicked, "Menú principal", etc.) should forget the
  // session so a later fresh visit doesn't try to rejoin a room/group the
  // player deliberately left.
  const leave = useCallback(() => {
    wsRef.current?.close();
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (reconnectedBannerRef.current) clearTimeout(reconnectedBannerRef.current);
    if (groupJoinedFallbackRef.current) clearTimeout(groupJoinedFallbackRef.current);
    setMe(null);
    setRoom(null);
    setMyRole(null);
    setGroupMe(null);
    setGroup(null);
    setConnectionPhase("menu");
    setReconnecting(false);
    setReconnectAttempt(0);
    setReconnectFailed(false);
    setJustReconnected(false);
    setColdStart(false);
    setRejoinChoicePending(false);
    setSessionGone(false);
  }, []);

  // The "rejoin" choice offered by SessionRecoveryOverlay once a cold-start
  // rejoin lands on a live round (see rejoinChoicePending above) — the
  // "decline" choice is just `leave` itself, same as every other "volver al
  // menú" in this hook.
  const confirmRejoin = useCallback(() => {
    setColdStart(false);
    setRejoinChoicePending(false);
  }, []);

  // Priority order matters: sessionGone/reconnectFailed/justReconnected are
  // all terminal-ish states of a live reconnect and win over a stale
  // coldStart flag that just hasn't been cleared yet; rejoinChoicePending
  // only means anything while still mid coldStart.
  const overlayMode: OverlayMode = !(coldStart || reconnecting || reconnectFailed || justReconnected || sessionGone)
    ? "none"
    : sessionGone
      ? "gone"
      : reconnectFailed
        ? "failed"
        : justReconnected
          ? "reconnected"
          : rejoinChoicePending
            ? "prompt"
            : "connecting";

  return {
    connectionPhase,
    setConnectionPhase,
    me,
    room,
    groupMe,
    group,
    myRole,
    wordReveal,
    roomPreview,
    setRoomPreview,
    error,
    errorKey,
    setError: setErrorExternal,
    reconnecting,
    reconnectAttempt,
    reconnectFailed,
    justReconnected,
    overlayMode,
    confirmRejoin,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    connect,
    retryConnection,
    send,
    leave,
  };
}
