import { useState, useEffect, useRef } from "react";
import { Btn } from "../../components/Btn";
import { getGame, GAME_LIST } from "../../games/registry";
import { isUnderMaintenance } from "../../games/maintenance";
import type { GameDef } from "../../games/gameTypes";
import { useMultiplayerSocket } from "./useMultiplayerSocket";
import { extractScannedCode } from "./joinLink";
import { MenuScreen } from "./MenuScreen";
import { GroupScreen } from "./GroupScreen";
import { LobbyScreen } from "./LobbyScreen";
import { RoundScreen } from "./RoundScreen";

// ═══════════════════════════════════════════════════════════════════════════════
// MULTIPLAYER SHELL (WebSocket) — two independent entry points:
//   - "room": a standalone room for one specific game, picked up front on the
//     home screen (create_room/join_room/rejoin) — unchanged from before the
//     group feature existed.
//   - "group": a persistent group (create_group/join_group/rejoin_group) that
//     can have several game instances open at once; any member opens an
//     instance (create_instance) and any member independently joins one
//     (join_instance) or leaves it (leave_instance) to go back to the group
//     screen. The instance itself, once attached (`joined`), reuses the same
//     per-game lobby/round/result UI as a standalone room — that machinery is
//     unrelated to the group/room distinction.
//
// This file owns every bit of session/UI state (join code, dialogs, toasts,
// the socket connection itself via useMultiplayerSocket) and the handlers
// that mutate it — MenuScreen/GroupScreen/LobbyScreen/RoundScreen are pure
// renders of one connectionPhase slice each, so a change to what's ON
// screen for a given phase touches one of those files, while a change to
// session/reconnect/toast behavior (shared across every phase) stays here.
// ═══════════════════════════════════════════════════════════════════════════════

interface MultiplayerGameProps {
  entryKind: "room" | "group";
  // Only meaningful for entryKind "room" — the game picked on the home
  // screen before ever connecting.
  gameId: string | null;
  // Collected once by App.tsx on first visit (and persisted there) — this
  // shell never asks for it itself, so creating/joining rooms and groups
  // never re-prompts.
  playerName: string;
  // Lets this screen update the stored name in place (e.g. after a "nombre
  // ya está en uso" error) instead of forcing the player back to App.tsx's
  // home screen just to retype it.
  onChangeName?: (name: string) => void;
  initialJoinCode?: string;
  // Only meaningful for entryKind "group" — lets the home screen's compact
  // group menu (tap "+" → Crear grupo / Unirme a un grupo) land directly on
  // the matching tab instead of the neutral menu screen.
  initialGroupIntent?: "create" | "join";
  // Lets the parent (App.tsx) keep its own header/title in sync with the
  // game actually active — e.g. after scanning a QR/join link for room X,
  // joining a room whose real gameType turns out to differ (a stale link,
  // or a different game than expected) should still show that room's actual
  // game, not whatever the link happened to encode. Called with null when
  // there's no active instance (e.g. sitting on the group screen).
  onGameTypeChange?: (gameType: string | null) => void;
  // Fires once the player has fully left the group (not just an instance
  // under it) — the group's own "menu" screen is indistinguishable from the
  // very first screen before ever connecting, so App.tsx needs this signal
  // to know it should leave the whole group flow and go back to its home
  // screen (pick a game / start a new group), not just re-render this shell.
  onLeaveGroup?: () => void;
  // Only meaningful for entryKind "room" — fires when the player typed a
  // code on the room-join form that turns out to belong to a group instead
  // (both are 5-char codes shared the same way, so this mix-up is common).
  // Lets the parent (App.tsx) switch the whole shell over to the group flow
  // with that code pre-filled, instead of this screen trying to join a
  // group itself — group membership follows different session rules than a
  // standalone room (see useMultiplayerSocket's groupSessionEnabled).
  onSwitchToGroup?: (code: string) => void;
  // Only meaningful for entryKind "group" — fires whenever membership in an
  // actual group flips (true once the join/create handshake lands, false on
  // leave_group). The parent uses this to make its global "Volver" header
  // button redirect to the group screen instead of exiting the whole group
  // flow, and its "Menú principal" button warn that continuing will leave
  // the group instead of doing so silently.
  onGroupAttachedChange?: (attached: boolean) => void;
  // Only meaningful for entryKind "group" — imperative escape hatch so the
  // parent's global header "Volver" button can send the player back to the
  // group screen (same as the in-lobby/in-round "👥 Volver al grupo"
  // control) without exiting the group. Safe to call even when already on
  // the group screen (the server's leave_instance is a no-op with nothing
  // attached), so mashing "Volver" repeatedly just leaves the player there.
  onExposeReturnToGroup?: (fn: () => void) => void;
  // Wraps "Crear partida"/"Unirse" so a themed game (see gameTheme on
  // GameDef) gets the same fade-to-black transition on the way into the
  // room as it already gets entering online mode itself — App.tsx passes
  // its withCurtain helper here. Defaults to calling the action straight
  // through, so every other game's plain "create/join" stays instant.
  runTransition?: (action: () => void) => void;
}

function playableGames(): GameDef[] {
  return (GAME_LIST as GameDef[]).filter(g => !g.comingSoon && !isUnderMaintenance(g) && !g.localOnly);
}

export function MultiplayerGame({
  entryKind,
  gameId,
  playerName,
  onChangeName,
  initialJoinCode,
  initialGroupIntent,
  onGameTypeChange,
  onLeaveGroup,
  onSwitchToGroup,
  onGroupAttachedChange,
  onExposeReturnToGroup,
  runTransition = action => action(),
}: MultiplayerGameProps) {
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
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  // Tracks a join_instance in flight so the tapped button can show
  // "Uniéndose..." instead of looking like nothing happened — and, since
  // send() silently drops the message if the socket isn't OPEN at the exact
  // moment of the tap (flaky connection, mid-reconnect), gives us something
  // to retry once the socket actually comes back (see the reconnect effect
  // below) instead of leaving the player stuck restarting the tap themselves.
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const pendingJoinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinInstance = (roomCode: string) => {
    setPendingJoinCode(roomCode);
    send({ type: "join_instance", roomCode });
    if (pendingJoinTimeoutRef.current) clearTimeout(pendingJoinTimeoutRef.current);
    // Covers the rare case where neither a success (phase leaves "group")
    // nor a server "error" ever comes back — without this the button would
    // stay stuck on "Uniéndose..." forever.
    pendingJoinTimeoutRef.current = setTimeout(() => {
      setPendingJoinCode(null);
      setError("No se pudo unir a la partida — probá de nuevo");
    }, 8000);
  };
  // Cleared once the join actually succeeds — connectionPhase moves off
  // "group" (into "lobby"). Deliberately not cleared on a generic error:
  // send() itself can flash "Sin conexión con el servidor" in the very same
  // tick as the tap (socket not OPEN yet), and that shouldn't cancel the
  // pending retry-on-reconnect below — a genuine server rejection (room
  // filled up, etc.) still surfaces via the error banner and just leaves the
  // button on "Uniéndose..." until the timeout above clears it.
  useEffect(() => {
    if (connectionPhase !== "group") setPendingJoinCode(null);
  }, [connectionPhase]);
  // The tap itself already reached send(), which flashed "Sin conexión con
  // el servidor" and dropped it if the socket wasn't OPEN — retry it once
  // reconnected instead of leaving the player to notice and tap again.
  useEffect(() => {
    if (justReconnected && pendingJoinCode && connectionPhase === "group") send({ type: "join_instance", roomCode: pendingJoinCode });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReconnected]);
  useEffect(
    () => () => {
      if (pendingJoinTimeoutRef.current) clearTimeout(pendingJoinTimeoutRef.current);
    },
    [],
  );
  // Leaving mid-game silently forfeits whatever's in progress, so that path
  // gets a confirm — same pattern as the pre-existing "volver al lobby"
  // confirms elsewhere. Leaving from the lobby (nothing to lose) doesn't.
  const [confirmLeaveInstance, setConfirmLeaveInstance] = useState(false);
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(false);
  // Host-only per-player actions (transfer host / kick) live behind a small
  // "⋮" menu instead of two always-visible buttons — only one open at a
  // time, keyed by playerId. Closed on outside click, same pattern as the
  // home screen's "+" group menu (see App.tsx's groupMenuRef).
  const [openPlayerMenu, setOpenPlayerMenu] = useState<string | null>(null);
  const playerMenuRef = useRef<HTMLDivElement>(null);
  // Some games' lobby has enough going on (player list + a meatier
  // ConfigPanel) that stacking both under one scroll reads as cluttered —
  // split them into top-level tabs instead, mirroring local mode's own
  // layout. Opt-in per game via GameDef.tabbedLobby (see gameTypes.ts);
  // most games' ConfigPanel is short enough that splitting it just adds a
  // click, so this only applies when the active game asks for it.
  const [lobbyTab, setLobbyTab] = useState<"players" | "config">("players");

  // Player disconnects/reconnects only ever show up as a flipped `online`
  // flag buried in the next full room-state broadcast — there's no distinct
  // server event for it. So this diffs each new player list against the
  // previous one (by id) and surfaces a brief toast for whoever flipped,
  // skipping ourselves (we already know our own connection state from the
  // reconnect banner above). Most useful when it's that player's turn and
  // everyone else is left wondering why nothing's happening.
  const prevOnlineRef = useRef<Record<string, boolean>>({});
  const [statusToast, setStatusToast] = useState<string | null>(null);
  useEffect(() => {
    if (!room) return;
    const prev = prevOnlineRef.current;
    for (const p of room.players) {
      if (p.id === me?.playerId) continue;
      const wasOnline = prev[p.id];
      if (wasOnline !== undefined && wasOnline !== p.online) {
        setStatusToast(p.online ? `${p.name} se reconectó` : `${p.name} se desconectó`);
      }
    }
    prevOnlineRef.current = Object.fromEntries(room.players.map(p => [p.id, p.online]));
  }, [room, me?.playerId]);

  // Same reusable toast as above, for two more events that otherwise happen
  // silently under everyone else: someone interrupting the match with
  // "Volver al lobby" (any player can now do this, not just the host — see
  // backToLobby) — relevant in any online room, standalone or group — and,
  // group instances only, a member leaving back to the group screen
  // ("Volver al grupo") — a standalone room has no "group screen" to return
  // to, so that half only makes sense there. Both are detected purely by
  // diffing the room's phase/roster between renders — no dedicated server
  // message needed, so this automatically covers every game through this
  // one shared shell instead of each RoundView having to wire it up itself.
  const prevRoomSnapshotRef = useRef<{ code: string; phase: string; players: Record<string, string> } | null>(null);
  useEffect(() => {
    if (!room) {
      prevRoomSnapshotRef.current = null;
      return;
    }
    const prev = prevRoomSnapshotRef.current;
    // A different room/instance than the one we were last watching — don't
    // compare across them (e.g. just switched instances inside a group).
    if (prev && prev.code === room.code) {
      if (prev.phase !== "lobby" && room.phase === "lobby") {
        setStatusToast("Volvieron al lobby");
      } else if (room.groupCode !== null) {
        const currentIds = new Set(room.players.map(p => p.id));
        const leftPlayerName = Object.entries(prev.players).find(([id]) => !currentIds.has(id))?.[1];
        if (leftPlayerName) setStatusToast(`${leftPlayerName} volvió al grupo`);
      }
    }
    prevRoomSnapshotRef.current = {
      code: room.code,
      phase: room.phase,
      players: Object.fromEntries(room.players.map(p => [p.id, p.name])),
    };
  }, [room]);

  useEffect(() => {
    if (!openPlayerMenu) return;
    const onClickOutside = (e: MouseEvent) => {
      if (playerMenuRef.current && !playerMenuRef.current.contains(e.target as Node)) setOpenPlayerMenu(null);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openPlayerMenu]);

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

  useEffect(() => {
    onGroupAttachedChange?.(!!group);
  }, [group, onGroupAttachedChange]);

  // The server's room.gameType is the only source of truth for which game
  // is actually active — surface it upward as soon as it's known, and clear
  // it back to null once there's no active instance (group screen).
  useEffect(() => {
    onGameTypeChange?.(room?.gameType ?? null);
  }, [room?.gameType, onGameTypeChange]);

  useEffect(() => {
    setConfirmLeaveInstance(false);
  }, [room?.code]);

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
  }, [error]);

  const saveName = (name: string) => {
    onChangeName?.(name);
    setError("");
  };

  const isHost = !!(me && room && room.hostId === me.playerId);
  const isGroupHost = !!(me && group && group.hostId === me.playerId);
  const myPlayer = room?.players?.find(p => p.id === me?.playerId);
  const selectedGame = (gameId ? getGame(gameId) : undefined) as GameDef | undefined;
  const activeGame = (room ? getGame(room.gameType) : selectedGame) as GameDef | undefined;
  const inGroup = entryKind === "group";

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

  // Shown across every phase — a dropped connection doesn't lose your spot
  // (see useMultiplayerSocket's session persistence), but the retry loop
  // needs to be visible or it just looks frozen. Three states: mid-retry,
  // a brief confirmation right after recovering, or — once the automatic
  // retries are exhausted — a manual choice instead of failing silently.
  const reconnectBanner = (reconnecting || justReconnected || reconnectFailed) && (
    <div
      style={{
        background: reconnectFailed ? "rgba(226,75,74,0.1)" : justReconnected ? "rgba(74,226,138,0.1)" : "rgba(226,196,74,0.1)",
        border: `1px solid ${reconnectFailed ? "rgba(226,75,74,0.3)" : justReconnected ? "rgba(74,226,138,0.3)" : "rgba(226,196,74,0.3)"}`,
        borderRadius: 10,
        padding: "10px 14px",
        marginBottom: 16,
        color: reconnectFailed ? "#F09595" : justReconnected ? "#7EE2A8" : "#E2C44A",
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {reconnectFailed
        ? `No pudimos reconectarte a la ${reconnectContext}.`
        : justReconnected
          ? "Reconectado ✓"
          : `Reconectando a la ${reconnectContext}... (intento ${reconnectAttempt} de ${maxReconnectAttempts})`}
      {reconnectFailed && (
        <div style={{ marginTop: 10, display: "flex", gap: 8, justifyContent: "center" }}>
          <Btn variant="success" onClick={retryConnection} style={{ padding: "6px 14px", fontSize: 13 }}>
            Reintentar
          </Btn>
          <Btn variant="ghost" onClick={leave} style={{ padding: "6px 14px", fontSize: 13 }}>
            Volver al menú
          </Btn>
        </div>
      )}
    </div>
  );

  // ── AUTO-CREATING A STANDALONE ROOM ── (see the auto-create effect above —
  // no form for this case, just a brief loading state while the room spins up)
  // ── MENU ──
  if (connectionPhase === "menu" || connectionPhase === "create" || connectionPhase === "join")
    return (
      <MenuScreen
        connectionPhase={connectionPhase}
        reconnectBanner={reconnectBanner}
        error={error}
        errorKey={errorKey}
        playerName={playerName}
        editingName={editingName}
        onEditingChange={setEditingName}
        onSaveName={saveName}
        onSetPhase={setConnectionPhase}
        inGroup={inGroup}
        roomName={roomName}
        onRoomNameChange={setRoomName}
        onCreateRoom={() => runTransition(createRoom)}
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        onJoinRoom={() => runTransition(joinRoom)}
        showScanner={showScanner}
        onShowScanner={setShowScanner}
        roomPreview={roomPreview}
        selectedGame={selectedGame}
        onSwitchToGroup={onSwitchToGroup}
        onScan={raw => {
          const code = extractScannedCode(raw);
          setShowScanner(false);
          if (code) setJoinCode(code);
          else setError("Ese código QR no es válido");
        }}
      />
    );

  // ── GROUP (attached to a group, no active instance) ──
  if (connectionPhase === "group" && group)
    return (
      <GroupScreen
        reconnectBanner={reconnectBanner}
        group={group}
        myPlayerId={me?.playerId}
        isGroupHost={isGroupHost}
        showQR={showQR}
        onShowQR={setShowQR}
        openPlayerMenu={openPlayerMenu}
        onTogglePlayerMenu={setOpenPlayerMenu}
        playerMenuRef={playerMenuRef}
        onTransferHost={id => {
          send({ type: "transfer_host", targetId: id });
          setOpenPlayerMenu(null);
        }}
        onKickMember={id => {
          send({ type: "kick_member", targetId: id });
          setOpenPlayerMenu(null);
        }}
        playableGames={playableGames()}
        showCreateInstance={showCreateInstance}
        onToggleCreateInstance={() => setShowCreateInstance(v => !v)}
        onCreateInstance={gameIdToCreate => {
          send({ type: "create_instance", gameType: gameIdToCreate });
          setShowCreateInstance(false);
        }}
        pendingJoinCode={pendingJoinCode}
        onJoinInstance={joinInstance}
        confirmLeaveGroup={confirmLeaveGroup}
        onConfirmLeaveGroup={() => setConfirmLeaveGroup(true)}
        onLeaveGroup={() => {
          send({ type: "leave_group" });
          setConfirmLeaveGroup(false);
        }}
        onCancelLeaveGroup={() => setConfirmLeaveGroup(false)}
        error={error}
        errorKey={errorKey}
      />
    );

  // ── LOBBY ── (either a standalone room or a group instance's lobby)
  if (connectionPhase === "lobby" && room) {
    return (
      <LobbyScreen
        room={room}
        myPlayerId={me?.playerId}
        isHost={isHost}
        activeGame={activeGame}
        statusToast={statusToast}
        onStatusToastExpire={() => setStatusToast(null)}
        reconnectBanner={reconnectBanner}
        showQR={showQR}
        onShowQR={setShowQR}
        lobbyTab={lobbyTab}
        onLobbyTabChange={setLobbyTab}
        openPlayerMenu={openPlayerMenu}
        onTogglePlayerMenu={setOpenPlayerMenu}
        playerMenuRef={playerMenuRef}
        onTransferHost={id => {
          send({ type: "transfer_host", targetId: id });
          setOpenPlayerMenu(null);
        }}
        onKickPlayer={id => {
          send({ type: "kick_player", targetId: id });
          setOpenPlayerMenu(null);
        }}
        updateConfig={updateConfig}
        onStartRound={() => send({ type: "start_round" })}
        onLeaveInstance={leaveInstance}
        error={error}
        errorKey={errorKey}
      />
    );
  }

  // ── EN PARTIDA: cualquier fase que no sea menú/lobby/group es propia del
  // juego, así que se delega entera — este shell no necesita conocer sus
  // nombres. El banner de error se muestra acá (no dentro de cada RoundView)
  // porque una acción rechazada por el servidor (turno equivocado, jugada
  // inválida, etc.) es un caso genérico común a cualquier juego.
  if (!["menu", "create", "join", "lobby", "group"].includes(connectionPhase) && room && activeGame) {
    return (
      <RoundScreen
        activeGame={activeGame}
        roundViewProps={{ room, me, myPlayer, myRole, wordReveal, isHost, send }}
        statusToast={statusToast}
        onStatusToastExpire={() => setStatusToast(null)}
        reconnectBanner={reconnectBanner}
        error={error}
        errorKey={errorKey}
        showReturnToGroup={room.groupCode !== null}
        confirmLeaveInstance={confirmLeaveInstance}
        onRequestLeaveInstance={() => setConfirmLeaveInstance(true)}
        onLeaveInstance={() => {
          leaveInstance();
          setConfirmLeaveInstance(false);
        }}
        onCancelLeaveInstance={() => setConfirmLeaveInstance(false)}
      />
    );
  }

  return <div style={{ textAlign: "center", padding: 40, color: "#6b6490" }}>Conectando...</div>;
}
