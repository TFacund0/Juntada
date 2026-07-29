import type { ReactNode, RefObject } from "react";
import { Suspense } from "react";
import { S } from "../../../theme/styles";
import { Avatar } from "../../../components/Avatar";
import { CodeDisplay } from "../../../components/CodeDisplay";
import { QRDialog } from "../../../components/QRDialog";
import { SetupTabs } from "../../../components/SetupTabs";
import { Toast } from "../../../components/Toast";
import { ErrorBanner } from "../../../components/ErrorBanner";
import { StickyActionBar } from "../../../components/StickyActionBar";
import { StartButton } from "../../../components/StartButton";
import { ReturnToGroupButton } from "../../../components/ReturnToGroupButton";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { buildRoomJoinUrl } from "../utils/joinLink";

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
  reconnectBanner,
  showQR,
  onShowQR,
  lobbyTab,
  onLobbyTabChange,
  openPlayerMenu,
  onTogglePlayerMenu,
  playerMenuRef,
  onTransferHost,
  onKickPlayer,
  updateConfig,
  onStartRound,
  onLeaveInstance,
  error,
  errorKey,
}: {
  room: RoomPublicState;
  myPlayerId: string | undefined;
  isHost: boolean;
  activeGame: GameDef | undefined;
  statusToast: string | null;
  onStatusToastExpire: () => void;
  reconnectBanner: ReactNode;
  showQR: boolean;
  onShowQR: (show: boolean) => void;
  lobbyTab: "players" | "config";
  onLobbyTabChange: (tab: "players" | "config") => void;
  openPlayerMenu: string | null;
  onTogglePlayerMenu: (id: string | null) => void;
  playerMenuRef: RefObject<HTMLDivElement>;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
  updateConfig: (patch: Record<string, unknown>) => void;
  onStartRound: () => void;
  onLeaveInstance: () => void;
  error: string;
  errorKey: number;
}) {
  const showLobbyTabs = isHost && !!activeGame?.tabbedLobby;
  return (
    <div style={isHost ? { paddingBottom: 88 } : undefined}>
      <Toast message={statusToast} onExpire={onStatusToastExpire} />
      {reconnectBanner}
      {/* A group instance isn't meant to be joined by raw code — group
          membership (join_instance from the group screen) is how people
          find it. A standalone room still shares its code here, since
          that's its only invite mechanism. */}
      {room.groupCode === null && (
        <>
          <CodeDisplay code={room.code} />
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 10 }}>
            <button
              onClick={() => onShowQR(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--jt-accent)",
                cursor: "pointer",
                fontSize: 13,
                fontFamily: "inherit",
                fontWeight: 700,
              }}
            >
              Invitar
            </button>
          </div>
          {showQR && (
            <QRDialog
              title="Escaneá para unirte"
              subtitle={`${room.name ? room.name + " · " : ""}Sala ${room.code} · ${activeGame?.label ?? ""}`}
              value={buildRoomJoinUrl(room.gameType, room.code)}
              onClose={() => onShowQR(false)}
            />
          )}
        </>
      )}
      {showLobbyTabs && (
        <div style={{ marginTop: 14 }}>
          <SetupTabs tab={lobbyTab} onChange={onLobbyTabChange} />
        </div>
      )}

      {(!showLobbyTabs || lobbyTab === "players") && (
        <div style={{ ...S.card, marginTop: showLobbyTabs ? 0 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={S.label}>
              {room.players.length}/{room.maxPlayers} jugadores
            </span>
            {room.players.length >= room.maxPlayers && <span style={S.pill(false)}>Sala llena</span>}
          </div>
          {room.players.map((p: PublicPlayer) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderBottom: "1px solid var(--jt-row-border, rgba(127,119,221,0.08))",
              }}
            >
              <Avatar name={p.name} size={32} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: p.id === myPlayerId ? 800 : 600,
                  color: p.id === myPlayerId ? "#fff" : undefined,
                }}
              >
                {p.name}
                {p.id === myPlayerId && " (vos)"}
              </span>
              {p.id === room.hostId && <span style={S.pill(false)}>Anfitrión</span>}
              {!p.online && <span style={S.pill(false)}>Desconectado</span>}
              {isHost && p.id !== myPlayerId && (
                <div ref={openPlayerMenu === p.id ? playerMenuRef : undefined} style={{ position: "relative" }}>
                  <button
                    onClick={() => onTogglePlayerMenu(openPlayerMenu === p.id ? null : p.id)}
                    aria-label={`Opciones para ${p.name}`}
                    style={{
                      ...S.btn("ghost"),
                      width: 30,
                      height: 30,
                      padding: 0,
                      borderRadius: 8,
                      fontSize: 16,
                      lineHeight: 1,
                      fontWeight: 800,
                    }}
                  >
                    ⋮
                  </button>
                  {openPlayerMenu === p.id && (
                    <div style={{ ...S.dropdownMenu, width: 170 }}>
                      {p.online && (
                        <button onClick={() => onTransferHost(p.id)} style={S.dropdownMenuItem}>
                          👑 Hacer anfitrión
                        </button>
                      )}
                      <button onClick={() => onKickPlayer(p.id)} style={{ ...S.dropdownMenuItem, color: "#F09595" }}>
                        🚫 Expulsar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isHost && (
        <>
          {activeGame?.ConfigPanel && (!showLobbyTabs || lobbyTab === "config") && (
            <Suspense fallback={null}>
              <activeGame.ConfigPanel room={room} updateConfig={updateConfig} />
            </Suspense>
          )}
          <StickyActionBar>
            {(() => {
              const notEnoughPlayers = room.players.length < (activeGame?.minPlayers ?? 3);
              const notReadyReason = notEnoughPlayers ? null : (activeGame?.canStart?.(room) ?? null);
              return (
                <>
                  <StartButton disabled={notEnoughPlayers || !!notReadyReason} onClick={onStartRound}>
                    {activeGame?.startLabel ?? "Iniciar ronda"}
                  </StartButton>
                  {notEnoughPlayers ? (
                    <p style={{ ...S.muted, textAlign: "center", marginTop: 8 }}>
                      Necesitás mínimo {activeGame?.minPlayers ?? 3} jugadores
                    </p>
                  ) : (
                    notReadyReason && <p style={{ fontSize: 12, color: "#E2C44A", textAlign: "center", marginTop: 8 }}>{notReadyReason}</p>
                  )}
                </>
              );
            })()}
          </StickyActionBar>
        </>
      )}

      {!isHost && (
        <>
          {activeGame?.LobbyInfo && (
            <Suspense fallback={null}>
              <activeGame.LobbyInfo room={room} />
            </Suspense>
          )}
          <div style={{ ...S.card, textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#9089c0" }}>Esperando que el anfitrión inicie la partida</p>
          </div>
        </>
      )}

      <ReturnToGroupButton groupCode={room.groupCode} roomPhase={room.phase} onLeave={onLeaveInstance} />

      <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
    </div>
  );
}
