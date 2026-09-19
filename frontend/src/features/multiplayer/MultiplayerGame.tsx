import { useCallback } from "react";
import type { RoomRoster } from "../../pages/context/GameSessionContext";
import { getGame } from "../../games/registry";
import { extractScannedCode } from "./utils/joinLink";
import { RoomEntryModal } from "./screens/RoomEntryModal";
import { RoomEntryCard } from "./screens/RoomEntryCard";
import { GroupEntryModal } from "./screens/GroupEntryModal";
import { GroupEntryCard } from "./screens/GroupEntryCard";
import { GroupScreen } from "./screens/GroupScreen";
import { LobbyScreen } from "./screens/LobbyScreen";
import { WaitingScreen } from "./screens/WaitingScreen";
import { RoundScreen } from "./screens/RoundScreen";
import { SessionRecoveryOverlay } from "./screens/SessionRecoveryOverlay";
import { FloatingChat } from "./components/FloatingChat";
import { ScreenFade } from "../../components/ui/ScreenFade";
import { useMultiplayerGameShell, playableGames } from "./hooks/useMultiplayerGameShell";
import { useMemberActions } from "./hooks/useMemberActions";
import { buildGroupChannel, buildRoomScreenChannels } from "./services/chatChannels";

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
// All the session/UI state (join code, dialogs, toasts, the socket connection
// itself) and the handlers that mutate it live in
// `hooks/useMultiplayerGameShell.ts` — this file is purely the render: one
// switch by `connectionPhase`, delegating to one of MenuScreen/GroupScreen/
// LobbyScreen/RoundScreen per phase. A change to what's ON screen for a given
// phase touches one of those files; a change to session/reconnect/toast
// behavior (shared across every phase) touches the hook instead.
// ═══════════════════════════════════════════════════════════════════════════════

export interface MultiplayerGameProps {
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
  // Lets the parent decide whether returning to the group (its global
  // "Volver" header button, see App.tsx's goBack) would actually interrupt
  // something — anything other than "lobby" means a round is genuinely in
  // progress (see utils/returnToGroup's roomHasProgress). Null when there's
  // no active instance.
  onRoomPhaseChange?: (roomPhase: string | null) => void;
  // Only meaningful for entryKind "room" — fires with the server-assigned
  // code once a room actually exists (create/join landed), null once there's
  // none. Lets the parent put the real code in the URL (see onGroupCodeChange
  // below for the group equivalent).
  onRoomCodeChange?: (code: string | null) => void;
  // Only meaningful for entryKind "group" — same idea as onRoomCodeChange,
  // for the group's own code.
  onGroupCodeChange?: (code: string | null) => void;
  // Fires once the player has fully left the group (not just an instance
  // under it) — the group's own "menu" screen is indistinguishable from the
  // very first screen before ever connecting, so App.tsx needs this signal
  // to know it should leave the whole group flow and go back to its home
  // screen (pick a game / start a new group), not just re-render this shell.
  onLeaveGroup?: () => void;
  // Only meaningful for entryKind "room" — closes the create/join modal's
  // own "✕" (RoomEntryModal) back to "elegí cómo jugar". Not the same as
  // `leave()` from useMultiplayerSocket: that only resets local connection
  // state back to connectionPhase "menu", which is still one of the phases
  // that renders this very modal — so without this prop the "✕" would just
  // flash the modal shut and immediately back open. App.tsx passes its
  // `goBack` here, same place its header's "Volver" button already goes.
  onExitRoomEntry?: () => void;
  // Usado por SessionRecoveryOverlay's "Volver al inicio" (sesión perdida/
  // sala que ya no existe/reconexión fallida) — a diferencia de
  // `onExitRoomEntry` (un paso atrás, a "elegí cómo jugar"), acá no queda
  // nada a lo que volver: la sala/grupo ya se perdió del todo, así que esto
  // manda derecho al picker de juegos. Tampoco alcanza con `leave()` de
  // useMultiplayerSocket: eso solo resetea el estado de conexión local de
  // vuelta a connectionPhase "menu", que sigue siendo una de las fases que
  // este mismo shell renderiza — sin este prop, "Volver al inicio" dejaba
  // gameId/mode intactos en App.tsx y el jugador terminaba viendo el mismo
  // modal de conectar en vez del menú principal. App.tsx pasa su `goHome`
  // acá, el mismo que ya usa el botón "Menú principal" del navbar.
  onGoHome?: () => void;
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
  // Only meaningful for entryKind "room" — same idea as onExposeReturnToGroup,
  // but for a standalone (groupless) room: lets the global header's "Volver"
  // button send an explicit leave_room right before this shell unmounts and
  // drops the socket, instead of the server only finding out via the plain
  // socket close a moment later (see useAppShell's confirmGoBack).
  onExposeLeaveRoom?: (fn: () => void) => void;
  // Only meaningful for entryKind "room" — lets the global GameNavbar's host-
  // only "Jugadores" panel (see RoomPlayersDialog) send transfer_host/
  // kick_player for whichever room is active, without that navbar (rendered
  // outside this shell, see AppHeader.tsx) needing its own socket. Paired
  // with onRoomRosterChange below, which is the read side of that same panel.
  onExposeRoomAction?: (fn: (msg: Record<string, unknown>) => void) => void;
  // Only meaningful for entryKind "room" — forwards the room's full public
  // state + which seat is "me" up to session state (see GameSessionContext's
  // RoomRoster) whenever it changes, null once there's no active room. The
  // global GameNavbar reads this (as an explicit prop, not through context —
  // it sits outside this shell's Provider tree) to render its "Jugadores"
  // panel in any phase, not just while LobbyScreen itself is mounted.
  onRoomRosterChange?: (roster: RoomRoster | null) => void;
  // Wraps "Crear partida"/"Unirse" so a themed game (see gameTheme on
  // GameDef) gets the same fade-to-black transition on the way into the
  // room as it already gets entering online mode itself — App.tsx passes
  // its withAsyncCurtain helper here. Defaults to calling the action straight
  // through, so every other game's plain "create/join" stays instant (its
  // own <ScreenFade> already covers that transition, see LobbyScreen/
  // RoundScreen below — stacking the curtain on top of that too, for every
  // game, made the two animations run at once and look like a stutter).
  // `themedOverride`: App.tsx's own closure only knows the *route's* game
  // (fixed upfront for entryKind "room") — a group's create/join-instance
  // targets a game picked from inside the group screen itself, so callers
  // here pass the target game's own themed-ness explicitly instead of
  // leaving App.tsx to guess from a gameId that hasn't caught up yet.
  runTransition?: (action: () => void, themedOverride?: boolean) => void;
  // Paired with runTransition: fires once whatever runTransition's curtain
  // was covering actually resolved (the room/group arrived, or the attempt
  // failed) — see the effect below. Lets the curtain in App.tsx stay down
  // for as long as the real create/join round-trip takes instead of a fixed
  // timer that doesn't know the network's actual latency.
  onTransitionSettled?: () => void;
  // App.tsx's own curtain state (see useCurtainTransition) — passed through
  // so the ScreenFade instances below (group/lobby/round) can skip their own
  // enter animation while runTransition's curtain is already covering the
  // exact same transition (a themed game's "Crear partida"/"Unirse" landing
  // on the lobby). Without this, that curtain and this shell's own
  // ScreenFade played at once, same "double reload" look that
  // App.tsx's top-level ScreenFade already guards against for
  // goBack/goHome — this covers the entry side of that same bug.
  curtain?: "none" | "in" | "out";
}

export function MultiplayerGame(props: MultiplayerGameProps) {
  const {
    playerName,
    onSwitchToGroup,
    onLeaveGroup,
    onExitRoomEntry,
    onGoHome,
    runTransition = action => action(),
    curtain = "none",
  } = props;
  // Computed once instead of repeating `curtain !== "none"` at each of the
  // three <ScreenFade> below (see the `curtain` prop doc above for why).
  const skipFade = curtain !== "none";
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
  } = useMultiplayerGameShell(props);

  // Wrapped in its own useCallback (not an inline arrow at the call site
  // below) — otherwise this would be a fresh function every render, and the
  // memoization inside useMemberActions would be defeated even though it
  // depends on this reference staying stable.
  const closePlayerMenu = useCallback(() => setOpenPlayerMenu(null), [setOpenPlayerMenu]);
  const { transferHost, kickMember, kickPlayer } = useMemberActions({ send, closePlayerMenu });

  // Block the whole screen — instead of a small banner floating over an
  // otherwise-tappable menu/lobby/round — for both a cold start (app just
  // opened/remounted with a session saved in localStorage) and any live
  // socket drop mid-session (flaky wifi, backgrounded tab). A dropped
  // connection used to "reconnect" invisibly while the player kept
  // interacting with a stale screen; this makes the state impossible to
  // miss or act on top of, and forces an explicit choice once retries run
  // out instead of failing silently. See useMultiplayerSocket's overlayMode
  // for the state machine behind this.
  if (overlayMode !== "none")
    return (
      <SessionRecoveryOverlay
        mode={overlayMode}
        contextLabel={reconnectContext}
        hostName={rejoinHostName}
        attempt={reconnecting ? reconnectAttempt : undefined}
        maxAttempts={maxReconnectAttempts}
        onReconnect={reconnectFailed ? retryConnection : confirmRejoin}
        onGoToMenu={onGoHome ?? leave}
        // Only offer "crear nueva sala" for a standalone room gone missing —
        // a gone group has no equivalent one-tap replacement here, so it
        // just falls back to "volver al inicio". Actually creates the room
        // right away (same one-tap flow as "Crear partida" on the menu)
        // instead of just opening the create form — the button reads as an
        // action, not a navigation shortcut, so it should do the thing it says.
        onCreateNew={
          overlayMode === "gone" && !groupMe
            ? () => {
                leave();
                runTransition(createRoom, Boolean(selectedGame?.gameTheme));
              }
            : undefined
        }
      />
    );

  // ── AUTO-CREATING A STANDALONE ROOM ── (see the auto-create effect above —
  // no form for this case, just a brief loading state while the room spins up)
  // ── MENU ──
  if (connectionPhase === "menu" || connectionPhase === "create" || connectionPhase === "join") {
    const onScan = (raw: string) => {
      const code = extractScannedCode(raw);
      setShowScanner(false);
      if (code) setJoinCode(code);
      else setError("Ese código QR no es válido");
    };

    // Entrar a un grupo (vs. hostear/unirse a una sala puntual de un juego ya
    // elegido) usa su propio modal con su propio motivo visual — ver
    // GroupEntryCard/GroupEntryModal vs. RoomEntryCard/RoomEntryModal más
    // abajo. Ambos comparten la misma idea de organización (modal centrado,
    // tabs crear/unirse) a propósito, pero cada uno con su propio look para
    // que no parezcan la misma pantalla.
    if (inGroup)
      return (
        <GroupEntryModal onClose={() => onLeaveGroup?.()}>
          <GroupEntryCard
            connectionPhase={connectionPhase}
            error={error}
            errorKey={errorKey}
            playerName={playerName}
            onSetPhase={setConnectionPhase}
            roomName={roomName}
            onRoomNameChange={setRoomName}
            onCreateRoom={() => {
              setSubmitting(true);
              runTransition(createRoom);
            }}
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            onJoinRoom={() => {
              setSubmitting(true);
              runTransition(joinRoom);
            }}
            submitting={submitting}
            showScanner={showScanner}
            onShowScanner={setShowScanner}
            onScan={onScan}
          />
        </GroupEntryModal>
      );

    return (
      <RoomEntryModal onClose={onExitRoomEntry ?? leave}>
        <RoomEntryCard
          connectionPhase={connectionPhase}
          error={error}
          errorKey={errorKey}
          playerName={playerName}
          onSetPhase={setConnectionPhase}
          onCreateRoom={() => {
            setSubmitting(true);
            runTransition(createRoom);
          }}
          joinCode={joinCode}
          onJoinCodeChange={setJoinCode}
          onJoinRoom={() => {
            setSubmitting(true);
            runTransition(joinRoom);
          }}
          submitting={submitting}
          showScanner={showScanner}
          onShowScanner={setShowScanner}
          roomPreview={roomPreview}
          selectedGame={selectedGame}
          onSwitchToGroup={onSwitchToGroup}
          onScan={onScan}
        />
      </RoomEntryModal>
    );
  }

  // ── GROUP (attached to a group, no active instance) ──
  if (connectionPhase === "group" && group)
    return (
      <>
        <ScreenFade transitionKey="group" skipAnimation={skipFade}>
          <GroupScreen
            group={group}
            myPlayerId={groupMe?.playerId}
            isGroupHost={isGroupHost}
            showQR={showQR}
            onShowQR={setShowQR}
            openPlayerMenu={openPlayerMenu}
            onTogglePlayerMenu={setOpenPlayerMenu}
            onTransferHost={transferHost}
            onKickMember={kickMember}
            playableGames={playableGames()}
            onCreateInstance={gameIdToCreate => {
              const targetGame = getGame(gameIdToCreate);
              runTransition(() => {
                send({ type: "create_instance", gameType: gameIdToCreate });
              }, Boolean(targetGame?.gameTheme));
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
        </ScreenFade>
        <FloatingChat channels={[buildGroupChannel(group, groupMe, send)]} />
      </>
    );

  // ── LOBBY ── (either a standalone room or a group instance's lobby)
  if (connectionPhase === "lobby" && room) {
    return (
      <>
        <ScreenFade transitionKey="lobby" skipAnimation={skipFade}>
          <LobbyScreen
            room={room}
            myPlayerId={me?.playerId}
            isHost={isHost}
            activeGame={activeGame}
            statusToast={statusToast}
            onStatusToastExpire={() => setStatusToast(null)}
            showQR={showQR}
            onShowQR={setShowQR}
            lobbyTab={lobbyTab}
            onLobbyTabChange={setLobbyTab}
            openPlayerMenu={openPlayerMenu}
            onTogglePlayerMenu={setOpenPlayerMenu}
            onTransferHost={transferHost}
            onKickPlayer={kickPlayer}
            updateConfig={updateConfig}
            onStartRound={() => send({ type: "start_round" })}
            error={error}
            errorKey={errorKey}
          />
        </ScreenFade>
        <FloatingChat
          channels={buildRoomScreenChannels({ room, group, groupMe, me, send, roomTitle: "Chat de la sala" })}
          defaultChannelId="room"
        />
      </>
    );
  }

  // ── ESPERANDO: se unió con la ronda ya en curso (ver roomService.joinRoom),
  // invisible para el engine del juego — nada que delegarle todavía.
  if (connectionPhase === "waiting" && room) {
    return (
      <>
        <ScreenFade transitionKey="waiting" skipAnimation={skipFade}>
          <WaitingScreen room={room} />
        </ScreenFade>
        <FloatingChat
          channels={buildRoomScreenChannels({ room, group, groupMe, me, send, roomTitle: "Chat de la sala" })}
          defaultChannelId="room"
        />
      </>
    );
  }

  // ── EN PARTIDA: cualquier fase que no sea menú/lobby/group/waiting es
  // propia del juego, así que se delega entera — este shell no necesita
  // conocer sus nombres. El banner de error se muestra acá (no dentro de
  // cada RoundView) porque una acción rechazada por el servidor (turno
  // equivocado, jugada inválida, etc.) es un caso genérico común a cualquier
  // juego.
  if (!["menu", "create", "join", "lobby", "group", "waiting"].includes(connectionPhase) && room && activeGame) {
    return (
      <>
        <ScreenFade transitionKey="round" skipAnimation={skipFade}>
          <RoundScreen
            activeGame={activeGame}
            roundViewProps={{ room, me, myPlayer, myRole, wordReveal, isHost, send, justEnteredRound }}
            statusToast={statusToast}
            onStatusToastExpire={() => setStatusToast(null)}
            error={error}
            errorKey={errorKey}
          />
        </ScreenFade>
        <FloatingChat
          channels={buildRoomScreenChannels({
            room,
            group,
            groupMe,
            me,
            send,
            roomTitle: activeGame.label ?? "Chat de la partida",
          })}
          defaultChannelId="room"
        />
      </>
    );
  }

  return <div style={{ textAlign: "center", padding: 40, color: "var(--jt-muted-text)" }}>Conectando...</div>;
}
