import type { ReactNode, RefObject } from "react";
import { Suspense, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { S } from "../../../theme/styles";
import { CodeDisplay } from "../../../components/ui/CodeDisplay";
import { QRDialog } from "../../../components/dialogs/QRDialog";
import { ShareLinkDialog } from "../../../components/dialogs/ShareLinkDialog";
import { SetupTabs } from "../../../components/setup/SetupTabs";
import { Toast } from "../../../components/ui/Toast";
import { ErrorBanner } from "../../../components/ui/ErrorBanner";
import { StartButton } from "../../../components/setup/StartButton";
import { GameLoadErrorBoundary } from "../../../components/shell/GameLoadErrorBoundary";
import { PlayerChip } from "../components/PlayerChip";
import type { GameDef } from "../../../games/gameTypes";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";
import { buildRoomJoinUrl, buildGroupJoinUrl } from "../utils/joinLink";
import "./LobbyScreen.css";

// Breakpoint de dos columnas — tiene que coincidir con el min-width:900px
// que gatilla jt-lobby-grid/jt-lobby-col/jt-lobby-config-scroll en
// LobbyScreen.css (no hay forma de leer ese valor desde JS, así que ambos
// lados quedan documentados entre sí en vez de solo uno de los dos).
const DESKTOP_BREAKPOINT_PX = 900;
// Mismo 600px que el max-height de respaldo en LobbyScreen.css (por si este
// cálculo corre antes de que el CSS haya aplicado, o si JS está deshabilitado).
const LOBBY_COL_MAX_HEIGHT_PX = 600;
// Piso para que una columna nunca quede recortada a casi nada en una
// ventana muy baja (notebook con poca altura, teclado en pantalla, etc).
const LOBBY_COL_MIN_HEIGHT_PX = 200;
// Aire extra debajo del cálculo exacto (altura disponible = viewport menos
// el propio top de la columna menos la barra fija) para no dejarla pegada
// al pixel justo del borde inferior.
const LOBBY_COL_BOTTOM_GAP_PX = 16;

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
  // La grilla muestra un "lugar" por cada cupo de la sala, no solo por
  // jugador ya sentado — los cupos libres quedan como chip vacío punteado,
  // así se ve de un vistazo cuánto falta llenar. Colapsado por defecto a 5
  // lugares (jugadores primero, después vacíos) con un "+N" que despliega
  // el resto — evita que un maxPlayers alto (hasta 20 en algunos juegos)
  // empuje toda la columna para abajo antes de llegar a la config/inicio.
  const [showAllSeats, setShowAllSeats] = useState(false);
  const emptySeatCount = Math.max(0, room.maxPlayers - room.players.length);
  const seats: Array<{ kind: "player"; player: PublicPlayer } | { kind: "empty"; key: string }> = [
    ...room.players.map(player => ({ kind: "player" as const, player })),
    ...Array.from({ length: emptySeatCount }, (_, i) => ({ kind: "empty" as const, key: `empty-${i}` })),
  ];
  const visibleSeats = showAllSeats ? seats : seats.slice(0, 5);
  const hiddenSeatCount = seats.length - visibleSeats.length;

  // El techo de altura de Jugadores/Config (LobbyScreen.css les da un tope
  // fijo relativo al viewport para que ninguno empuje la página ni se pase
  // por encima de la barra de "Iniciar ronda") no puede ser un solo valor de
  // CSS: cuánto aire hay arriba de cada columna cambia según el juego, si
  // hay tabbedLobby, y cuál tab está activa (ej. "Configuración" arranca más
  // abajo que "Jugadores" porque el código/QR de la sala sigue visible
  // arriba de las dos). Medimos acá en vez de adivinar un número fijo en el
  // CSS, que o dejaba aire de más en una tab o se solapaba con la barra fija
  // en la otra. Solo aplica desde el breakpoint de dos columnas (LobbyScreen
  // .css) — en mobile las columnas no tienen techo a propósito, se alargan
  // lo que haga falta y scrollea la página entera, como cualquier pantalla
  // larga de celular.
  const colRef = useRef<HTMLDivElement>(null);
  const configScrollRef = useRef<HTMLDivElement>(null);
  const actionBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const recompute = () => {
      const els = [colRef.current, configScrollRef.current];
      if (window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        for (const el of els) if (el) el.style.maxHeight = "";
        return;
      }
      const barHeight = actionBarRef.current?.getBoundingClientRect().height ?? 0;
      for (const el of els) {
        if (!el) continue;
        const available = window.innerHeight - el.getBoundingClientRect().top - barHeight - LOBBY_COL_BOTTOM_GAP_PX;
        el.style.maxHeight = `${Math.max(LOBBY_COL_MIN_HEIGHT_PX, Math.min(LOBBY_COL_MAX_HEIGHT_PX, available))}px`;
      }
    };
    recompute();
    // Un frame después: la primera medición puede caer antes de que el
    // ConfigPanel del juego activo (cargado por Suspense) termine de pintar
    // su contenido real.
    const raf = requestAnimationFrame(recompute);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      cancelAnimationFrame(raf);
    };
  }, [lobbyTab, isHost, activeGame?.id, room.players.length, room.maxPlayers, showAllSeats]);

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
      {reconnectBanner}

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
            <>
              <CodeDisplay code={room.code} />
              <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10 }} className="jt-animate-rise">
                <button onClick={() => onShowQR(true)} className="jt-lobby-link-btn">
                  ▦ Ver QR
                </button>
                <button onClick={() => setShowShareLink(true)} className="jt-lobby-link-btn">
                  ↗ Compartir enlace
                </button>
              </div>
              {showQR && (
                <QRDialog
                  title="Escaneá para unirte"
                  subtitle={`${room.name ? room.name + " · " : ""}Sala ${room.code} · ${activeGame?.label ?? ""}`}
                  value={buildRoomJoinUrl(room.gameType, room.code)}
                  onClose={() => onShowQR(false)}
                  showShare={false}
                />
              )}
              {showShareLink && (
                <ShareLinkDialog
                  title="Compartir enlace de invitación"
                  subtitle={`${room.name ? room.name + " · " : ""}Sala ${room.code} · ${activeGame?.label ?? ""}`}
                  value={buildRoomJoinUrl(room.gameType, room.code)}
                  onClose={() => setShowShareLink(false)}
                />
              )}
            </>
          ) : (
            <>
              <CodeDisplay code={room.groupCode} label="GRUPO" />
              <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 10 }} className="jt-animate-rise">
                <button onClick={() => onShowQR(true)} className="jt-lobby-link-btn">
                  ▦ Ver QR
                </button>
                <button onClick={() => setShowShareLink(true)} className="jt-lobby-link-btn">
                  ↗ Compartir enlace
                </button>
              </div>
              {showQR && (
                <QRDialog
                  title="Escaneá para unirte al grupo"
                  subtitle={`Grupo ${room.groupCode}`}
                  value={buildGroupJoinUrl(room.groupCode)}
                  onClose={() => onShowQR(false)}
                  showShare={false}
                />
              )}
              {showShareLink && (
                <ShareLinkDialog
                  title="Compartir enlace de invitación"
                  subtitle={`Grupo ${room.groupCode}`}
                  value={buildGroupJoinUrl(room.groupCode)}
                  onClose={() => setShowShareLink(false)}
                />
              )}
            </>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 10px" }}>
                <span style={{ ...S.label, marginBottom: 0 }}>Jugadores</span>
                <span style={S.pill(false)}>
                  {room.players.length} / {room.maxPlayers}
                </span>
              </div>
              <div className="jt-lobby-card" style={S.card}>
                <div className="jt-player-grid jt-thin-scrollbar">
                  {visibleSeats.map((seat, i) =>
                    seat.kind === "player" ? (
                      <PlayerChip
                        key={seat.player.id}
                        player={seat.player}
                        isMe={seat.player.id === myPlayerId}
                        isHostPlayer={seat.player.id === room.hostId}
                        canManage={isHost && seat.player.id !== myPlayerId}
                        menuOpen={openPlayerMenu === seat.player.id}
                        menuRef={playerMenuRef}
                        onToggleMenu={onTogglePlayerMenu}
                        onTransferHost={onTransferHost}
                        onKickPlayer={onKickPlayer}
                        animationDelay={i * 40}
                      />
                    ) : room.groupCode === null ? (
                      <button
                        key={seat.key}
                        type="button"
                        onClick={() => setShowShareLink(true)}
                        className="jt-player-chip-empty jt-player-chip-empty--invitable jt-animate-rise"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <span className="jt-player-chip-empty-label">
                          <span className="jt-player-chip-empty-default">Vacío</span>
                          <span className="jt-player-chip-empty-hint">Invitar</span>
                        </span>
                      </button>
                    ) : (
                      <div key={seat.key} className="jt-player-chip-empty jt-animate-rise" style={{ animationDelay: `${i * 40}ms` }}>
                        Vacío
                      </div>
                    ),
                  )}
                  {hiddenSeatCount > 0 && (
                    <button className="jt-player-chip-more" onClick={() => setShowAllSeats(true)}>
                      <span className="jt-player-chip-more-count">+{hiddenSeatCount}</span>
                      Ver todos
                    </button>
                  )}
                  {showAllSeats && seats.length > 5 && (
                    <button className="jt-player-chip-more" onClick={() => setShowAllSeats(false)}>
                      Ver menos
                    </button>
                  )}
                </div>
              </div>
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
              {startAction}
            </div>
          </div>,
          document.body,
        )}

      <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
    </div>
  );
}
