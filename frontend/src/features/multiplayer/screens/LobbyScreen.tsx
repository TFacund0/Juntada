import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { S } from "../../../theme/styles";
import { SetupTabs } from "../../../components/setup/SetupTabs";
import { Toast } from "../../../components/ui/Toast";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { StartButton } from "../../../components/setup/StartButton";
import { GameLoadErrorBoundary } from "../../../components/shell/GameLoadErrorBoundary";
import { LobbyRoomInvite } from "../components/lobby/LobbyRoomInvite";
import { LobbyGroupInvite } from "../components/lobby/LobbyGroupInvite";
import { LobbySeatGrid } from "../components/lobby/LobbySeatGrid";
import { useLobbyColumnMaxHeight } from "../hooks/useLobbyColumnMaxHeight";
import { useLobbySeats } from "../hooks/useLobbySeats";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomPublicState } from "@juntada/shared-types";
import "./LobbyScreen.css";

// A standalone room's or group instance's lobby: room code (standalone
// only), player list with host-only per-player actions, the active game's
// own ConfigPanel/LobbyInfo, and the start button. Covers connectionPhase
// "lobby" — extracted verbatim out of MultiplayerGame.tsx, which still owns
// all of this screen's state.
export function LobbyScreen({
  room,
  myPlayerId,
  isHost,
  activeGame,
  statusToast,
  onStatusToastExpire,
  showQR,
  onShowQR,
  lobbyTab,
  onLobbyTabChange,
  openPlayerMenu,
  onTogglePlayerMenu,
  onTransferHost,
  onKickPlayer,
  updateConfig,
  onStartRound,
  error,
  errorKey,
}: {
  room: RoomPublicState;
  myPlayerId: string | undefined;
  isHost: boolean;
  activeGame: GameDef | undefined;
  statusToast: string | null;
  onStatusToastExpire: () => void;
  showQR: boolean;
  onShowQR: (show: boolean) => void;
  lobbyTab: "players" | "config";
  onLobbyTabChange: (tab: "players" | "config") => void;
  openPlayerMenu: string | null;
  onTogglePlayerMenu: (id: string | null) => void;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
  updateConfig: (patch: Record<string, unknown>) => void;
  onStartRound: () => void;
  error: string;
  errorKey: number;
}) {
  // Las pestañas "Jugadores"/"Config" solo tienen sentido en mobile, donde
  // una sola columna no tiene lugar para las dos cosas a la vez — desde el
  // breakpoint de dos columnas (LobbyScreen.css) ambas están siempre
  // visibles lado a lado, así que acá siempre se renderizan las dos y es el
  // CSS (no esta condición) quien decide cuál tapar en mobile.
  const showLobbyTabs = isHost && !!activeGame?.tabbedLobby;
  // Estado propio de esta pantalla (a diferencia de showQR, que vive en
  // MultiplayerGame porque GroupScreen también lo usa) — "compartir enlace"
  // es una acción exclusiva de la sala, no necesita subir más arriba.
  const [showShareLink, setShowShareLink] = useState(false);
  const { seats, visibleSeats, hiddenSeatCount, showAllSeats, setShowAllSeats } = useLobbySeats(room);

  const { colRef, configScrollRef, actionBarRef } = useLobbyColumnMaxHeight({
    lobbyTab,
    isHost,
    activeGameId: activeGame?.id,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    showAllSeats,
  });

  const notEnoughPlayers = room.players.length < (activeGame?.minPlayers ?? 3);
  const notReadyReason = notEnoughPlayers ? null : (activeGame?.canStart?.(room) ?? null);
  // Una sola instancia de la acción de inicio, ubicada abajo de las dos
  // columnas (jugadores + config) tanto en mobile como en desktop — no vive
  // dentro de ninguna columna para no competir en ancho con el ConfigPanel
  // del juego activo, que ya trae su propio contenido.
  const startAction = (
    <>
      <StartButton disabled={notEnoughPlayers || !!notReadyReason} onClick={onStartRound}>
        {activeGame?.startLabel ?? "Iniciar ronda"}
      </StartButton>
      {notEnoughPlayers ? (
        <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>Necesitás mínimo {activeGame?.minPlayers ?? 3} jugadores</p>
      ) : (
        notReadyReason && <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>{notReadyReason}</p>
      )}
    </>
  );

  return (
    <div className={`jt-lobby-root${isHost ? " jt-lobby-host-pad" : ""}`}>
      <div className="jt-lobby-glow jt-lobby-glow--a jt-animate-drift" aria-hidden="true" />
      <Toast message={statusToast} onExpire={onStatusToastExpire} />

      <div className="jt-lobby-grid jt-lobby-breakout">
        <div className="jt-lobby-col jt-thin-scrollbar" ref={colRef}>
          {/* Una instancia de grupo no se une por el código de la sala en sí
              — quien invita comparte el código del GRUPO, y desde ahí entra
              a la partida abierta (join_instance en GroupScreen). Por eso
              acá mostramos ese código de grupo, no el de la sala, para que
              la invitación siga siendo posible sin salir del lobby. Una
              sala independiente (sin grupo) comparte su propio código, que
              es su único mecanismo de invitación. */}
          {room.groupCode === null ? (
            <LobbyRoomInvite
              room={room}
              activeGameLabel={activeGame?.label}
              showQR={showQR}
              onShowQR={onShowQR}
              showShareLink={showShareLink}
              onShowShareLink={setShowShareLink}
            />
          ) : (
            <LobbyGroupInvite
              groupCode={room.groupCode}
              showQR={showQR}
              onShowQR={onShowQR}
              showShareLink={showShareLink}
              onShowShareLink={setShowShareLink}
            />
          )}
          {showLobbyTabs && (
            <div className="jt-lobby-tabs-mobile" style={{ marginTop: 14 }}>
              <SetupTabs tab={lobbyTab} onChange={onLobbyTabChange} />
            </div>
          )}

          {
            <div
              className={`jt-animate-rise${showLobbyTabs ? ` jt-lobby-tab-panel${lobbyTab === "players" ? " jt-lobby-tab-panel-active" : ""}` : ""}`}
              style={{ marginTop: 14, animationDelay: "60ms" }}
            >
              <LobbySeatGrid
                room={room}
                myPlayerId={myPlayerId}
                isHost={isHost}
                visibleSeats={visibleSeats}
                hiddenSeatCount={hiddenSeatCount}
                totalSeatCount={seats.length}
                showAllSeats={showAllSeats}
                onShowAllSeats={setShowAllSeats}
                openPlayerMenu={openPlayerMenu}
                onTogglePlayerMenu={onTogglePlayerMenu}
                onTransferHost={onTransferHost}
                onKickPlayer={onKickPlayer}
                onShowShareLink={setShowShareLink}
              />
            </div>
          }
        </div>

        <div className="jt-lobby-side jt-lobby-col">
          {isHost && activeGame?.ConfigPanel && (
            <div
              ref={configScrollRef}
              className={`jt-animate-rise jt-lobby-config-anim jt-lobby-config-scroll jt-thin-scrollbar${showLobbyTabs ? ` jt-lobby-tab-panel${lobbyTab === "config" ? " jt-lobby-tab-panel-active" : ""}` : ""}`}
              style={{ animationDelay: "110ms" }}
            >
              <GameLoadErrorBoundary key={activeGame.id}>
                <Suspense fallback={null}>
                  <activeGame.ConfigPanel room={room} updateConfig={updateConfig} />
                </Suspense>
              </GameLoadErrorBoundary>
            </div>
          )}

          {!isHost && (
            <div
              ref={configScrollRef}
              className="jt-animate-rise jt-lobby-config-scroll jt-thin-scrollbar"
              style={{ animationDelay: "110ms" }}
            >
              {activeGame?.LobbyInfo && (
                <GameLoadErrorBoundary key={activeGame.id}>
                  <Suspense fallback={null}>
                    <activeGame.LobbyInfo room={room} />
                  </Suspense>
                </GameLoadErrorBoundary>
              )}
              <div className="jt-lobby-waiting-card" style={{ ...S.card, textAlign: "center" }}>
                <span className="jt-lobby-waiting-dot" />
                <p style={{ fontSize: 15, color: "#9089c0", margin: 0 }}>Esperando que el anfitrión inicie la partida</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isHost &&
        // Portal a document.body: esta barra cuelga del <ScreenFade> de
        // App.tsx, que anima con `transform` durante 0.32s al entrar al
        // lobby — sin el portal quedaría atrapada por ese `transform` (mal
        // ubicada) en vez de fija al viewport durante ese instante. Mismo
        // motivo que StickyActionBar/RoomEntryModal.
        createPortal(
          <div ref={actionBarRef} className="jt-lobby-action-bar jt-lobby-breakout">
            <div className="jt-lobby-action-inner jt-animate-rise" style={{ animationDelay: "160ms" }}>
              <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
              {startAction}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
