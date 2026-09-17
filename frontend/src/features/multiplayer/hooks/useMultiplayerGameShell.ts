import { useState, useEffect, useRef } from "react";
import { GAME_LIST } from "../../../games/registry";
import { isGameAvailable } from "../../../games/maintenance";
import type { GameDef } from "../../../games/gameTypes";
import { useMultiplayerSocket } from "./useMultiplayerSocket";
import { useForwardProp } from "../../../hooks/ui/useForwardProp";
import { usePlayerPresenceToasts } from "./usePlayerPresenceToasts";
import { useRoomEventToasts } from "./useRoomEventToasts";
import { usePendingJoinRetry } from "./usePendingJoinRetry";
import { useSubmitCurtain } from "./useSubmitCurtain";
import { useShellPermissions } from "./useShellPermissions";
import type { MultiplayerGameProps } from "../MultiplayerGame";

export function playableGames(): GameDef[] {
  return (GAME_LIST as GameDef[]).filter(g => isGameAvailable(g) && !g.localOnly);
}

/**
 * Todo el estado/efectos/handlers del shell multijugador — extraído tal cual
 * de MultiplayerGame.tsx (que ahora solo llama a este hook y renderiza el
 * switch por `connectionPhase`). Ver el comentario de "MAPA DEL ARCHIVO" que
 * seguía encabezando ese componente: las secciones 2 a 8 de ese mapa son
 * exactamente lo que vive acá ahora.
 */
export function useMultiplayerGameShell({
  entryKind,
  gameId,
  playerName,
  onChangeName,
  initialJoinCode,
  initialGroupIntent,
  onGameTypeChange,
  onRoomPhaseChange,
  onRoomCodeChange,
  onGroupCodeChange,
  onLeaveGroup,
  onGroupAttachedChange,
  onExposeReturnToGroup,
  runTransition = action => action(),
  onTransitionSettled,
}: MultiplayerGameProps) {
  // 21 of these 24 fields flow straight through to this hook's own return
  // (setRoomPreview, justReconnected, and connect are consumed internally
  // instead). This passthrough is an intentional API boundary, not
  // accidental coupling — see sdd/multiplayer-gameshell-refactor design.
  const {
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
    setError,
    reconnecting,
    reconnectAttempt,
    reconnectFailed,
    justReconnected,
    overlayMode,
    confirmRejoin,
    maxReconnectAttempts,
    connect,
    retryConnection,
    send,
    leave,
  } = useMultiplayerSocket({ onLeftGroup: onLeaveGroup, entryKind });

  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");
  // Controlled (not just owned by NamePillEditor itself) because the "ya
  // está en uso" effect below also needs to force it open from outside.
  const [editingName, setEditingName] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const curtain = useSubmitCurtain({ connectionPhase, setError, onTransitionSettled });
  const { submitting, setSubmitting, armSubmitTimeout } = curtain;

  const { pendingJoinCode, joinInstance } = usePendingJoinRetry({
    connectionPhase,
    justReconnected,
    group,
    send,
    setError,
    runTransition,
  });
  // Leaving the group outright — separate confirm from "volver al grupo"
  // (the navbar's "Volver" arrow, see useAppNavigation's goBack), which only
  // steps back to the group screen without leaving it.
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(false);
  // Host-only per-player actions (transfer host / kick) live behind a small
  // "⋮" menu instead of two always-visible buttons — only one open at a
  // time, keyed by playerId. Opens a centered MemberActionsDialog, which
  // closes itself on overlay click/Cancel.
  const [openPlayerMenu, setOpenPlayerMenu] = useState<string | null>(null);
  // Some games' lobby has enough going on (player list + a meatier
  // ConfigPanel) that stacking both under one scroll reads as cluttered —
  // split them into top-level tabs instead, mirroring local mode's own
  // layout. Opt-in per game via GameDef.tabbedLobby (see gameTypes.ts);
  // most games' ConfigPanel is short enough that splitting it just adds a
  // click, so this only applies when the active game asks for it.
  const [lobbyTab, setLobbyTab] = useState<"players" | "config">("players");

  // Player disconnects/reconnects, "Volver al lobby", and a group member
  // leaving back to the group screen only ever show up as diffs in the next
  // full room-state broadcast — there's no distinct server event for any of
  // them. Both hooks below surface a brief toast purely by comparing the
  // current `room` against its own previous render.
  const [statusToast, setStatusToast] = useState<string | null>(null);
  usePlayerPresenceToasts({ room, myPlayerId: me?.playerId, setStatusToast });
  useRoomEventToasts({ room, myPlayerId: me?.playerId, setStatusToast, setLobbyTab });

  const inGroup = entryKind === "group";

  // Scanned a "join this room/group" QR/link — the code is already known
  // and the player's name was already collected by App.tsx before this
  // screen ever mounts, so there's nothing left to ask: join immediately
  // instead of just pre-filling the form and waiting for an extra tap. The
  // join form still renders underneath (connectionPhase "join") so a
  // failure (full room, bad code, name taken, ...) leaves the player on a
  // normal, editable join screen instead of a dead end.
  // Guards the live-preview effect below from also calling connect() on the
  // same render pass as the auto-join above — both would otherwise open
  // their own WebSocket (neither sees the other's as OPEN yet, since both
  // fire before any handshake completes), and whichever opens second wins
  // wsRef, silently orphaning the socket the actual join was sent on. Reset
  // once the join attempt fails, so retyping the code afterwards still gets
  // a live preview.
  const autoJoiningRef = useRef(false);

  useEffect(() => {
    if (connectionPhase !== "menu") return;
    if (initialJoinCode) {
      setConnectionPhase("join");
      autoJoiningRef.current = true;
      const code = initialJoinCode.toUpperCase().trim();
      connect(ws => ws.send(JSON.stringify({ type: inGroup ? "join_group" : "join_room", code, playerName })));
    } else if (initialGroupIntent) setConnectionPhase(initialGroupIntent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useForwardProp(!!group, onGroupAttachedChange);

  // The server's room.gameType is the only source of truth for which game
  // is actually active — surface it upward as soon as it's known, and clear
  // it back to null once there's no active instance (group screen). The
  // cleanup matters as much as the effect itself: "Volver" from inside a
  // room unmounts this whole shell directly (App.tsx's goBack/confirmGoBack)
  // without ever going through `leave()`'s `setRoom(null)`, so without this
  // cleanup the parent's `inRoom` flag stayed stuck at `true` past the
  // unmount — the next time the player re-entered online mode for the same
  // themed game, useAppNavigation's `inGameView` briefly read stale-true and
  // useGameTheme flashed that game's theme colors for a commit before the
  // fresh shell's own effect corrected it.
  useForwardProp(room?.gameType ?? null, onGameTypeChange, { clearOnUnmount: true });

  useForwardProp(room?.phase ?? null, onRoomPhaseChange);

  // The server-assigned code is only known once a room/group actually
  // exists (after create/join lands) — App.tsx uses this to put the real
  // code in the URL (replacing the code-less /room/:gameId or /group route
  // used while still on the create/join form) so the address bar becomes
  // shareable from that point on.
  useForwardProp(room?.code ?? null, onRoomCodeChange);

  useForwardProp(group?.code ?? null, onGroupCodeChange);

  // Live preview of a standalone room as soon as the code is fully typed —
  // read-only lookup, no commitment (see checkRoomCode/room_preview on the
  // backend). Also used on the room-join form to detect a code that
  // actually belongs to a group (see isGroupCode below), so it stays
  // enabled even for entryKind "room".
  useEffect(() => {
    if (entryKind === "group") return;
    if (autoJoiningRef.current) return;
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) {
      setRoomPreview(null);
      return;
    }
    connect(ws => ws.send(JSON.stringify({ type: "check_room_code", code })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode, entryKind]);

  // A join rejected for having a name someone else already has in that
  // room/group is recoverable right here — open the inline rename instead
  // of leaving the player stuck re-reading the same error with no way to
  // act on it short of abandoning this screen to edit the name elsewhere.
  useEffect(() => {
    if (!error) return;
    // The auto-join attempt above is done (successfully or not) once an
    // error comes back — let the live preview resume for any further
    // manual retry.
    autoJoiningRef.current = false;
    if (error.includes("ya está en uso")) setEditingName(true);
    // Whatever runTransition's curtain was covering (create/join) is done
    // either way once an error comes back — an unresolved request would
    // otherwise leave it down until the safety timeout, hiding the error
    // banner from view for that whole stretch.
    curtain.settle();
  }, [error, curtain.settle]);

  const saveName = (name: string) => {
    onChangeName?.(name);
    setError("");
  };

  const { isHost, isGroupHost, myPlayer, selectedGame, activeGame } = useShellPermissions({
    me,
    room,
    group,
    gameId,
  });

  // Tracks connectionPhase across renders (mutated during render, same
  // sentinel-ref pattern as RoundView's own prevRoomPhase) purely to detect
  // the "lobby" → anything-else edge — i.e. a match just starting. A
  // per-game RoundView only mounts once connectionPhase already left
  // "lobby", so it can't observe that edge itself; this shell can, since it
  // renders through every phase.
  const prevConnectionPhaseRef = useRef(connectionPhase);
  const justEnteredRound = prevConnectionPhaseRef.current === "lobby" && connectionPhase !== "lobby";
  prevConnectionPhaseRef.current = connectionPhase;

  const createRoom = () => {
    // A room is created with one tap, no form: always an auto-generated
    // code and a default name (the game's own name — good enough, since a
    // room only lives for one match). Groups also always get an
    // auto-generated code — letting the host pick their own invited
    // collisions/weak codes like "1234" for no real benefit.
    connect(ws => {
      if (inGroup) {
        ws.send(JSON.stringify({ type: "create_group", playerName, groupName: roomName.trim() || undefined }));
      } else {
        ws.send(
          JSON.stringify({
            type: "create_room",
            playerName,
            roomName: selectedGame?.label ?? "Mi sala",
            gameType: gameId,
          }),
        );
      }
    });
    armSubmitTimeout(inGroup ? "No se pudo crear el grupo — probá de nuevo" : "No se pudo crear la partida — probá de nuevo");
  };

  const joinRoom = () => {
    if (!joinCode.trim()) return setError("Ingresá el código");
    const code = joinCode.toUpperCase().trim();
    connect(ws =>
      ws.send(
        JSON.stringify({
          type: inGroup ? "join_group" : "join_room",
          code,
          playerName,
        }),
      ),
    );
    armSubmitTimeout(inGroup ? "No se pudo unir al grupo — probá de nuevo" : "No se pudo unir a la partida — probá de nuevo");
  };

  const updateConfig = (patch: Record<string, unknown>) => {
    if (!room) return;
    send({ type: "update_config", config: patch });
  };

  const leaveInstance = () => send({ type: "leave_instance" });

  useEffect(() => {
    onExposeReturnToGroup?.(leaveInstance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onExposeReturnToGroup]);

  // Whether a session belongs to a room or a group is decided the same way
  // the socket itself decides which rejoin message to send on reconnect
  // (see useMultiplayerSocket's onopen: groupMe takes priority) — so the
  // banner's wording always matches what's actually being rejoined.
  const reconnectContext = groupMe ? "grupo" : "sala";
  // Who to greet on the "prompt" overlay (see SessionRecoveryOverlay) —
  // the room's own host, since that's whose game is being rejoined.
  const rejoinHostName = room?.players.find(p => p.id === room.hostId)?.name;

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
    error,
    errorKey,
    setError,
    reconnecting,
    reconnectAttempt,
    reconnectFailed,
    overlayMode,
    confirmRejoin,
    maxReconnectAttempts,
    retryConnection,
    send,
    leave,
    roomName,
    setRoomName,
    joinCode,
    setJoinCode,
    submitting,
    setSubmitting,
    editingName,
    setEditingName,
    showQR,
    setShowQR,
    showScanner,
    setShowScanner,
    pendingJoinCode,
    joinInstance,
    confirmLeaveGroup,
    setConfirmLeaveGroup,
    openPlayerMenu,
    setOpenPlayerMenu,
    lobbyTab,
    setLobbyTab,
    statusToast,
    setStatusToast,
    inGroup,
    saveName,
    isHost,
    isGroupHost,
    myPlayer,
    selectedGame,
    activeGame,
    justEnteredRound,
    createRoom,
    joinRoom,
    updateConfig,
    reconnectContext,
    rejoinHostName,
  };
}
