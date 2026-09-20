import { Suspense, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
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

// Breakpoint de dos columnas — tiene que coincidir con DESKTOP_BREAKPOINT_PX
// en useLobbyColumnMaxHeight.ts (no hay forma de leer una constante JS desde
// una clase de Tailwind, así que ambos lados quedan documentados entre sí en
// vez de solo uno de los dos). No es ninguno de los breakpoints por defecto
// de Tailwind (md=768, lg=1024), por eso todo usa el arbitrario `min-[900px]`
// escrito LITERAL en cada clase — Tailwind escanea el texto crudo del
// archivo antes de que corra ningún JS, así que una constante interpolada
// como `` `${DESKTOP_BP}:grid` `` nunca genera la clase real: el scanner
// nunca ve el string final "min-[900px]:grid", solo el template literal sin
// resolver. Deja de doler la repetición, pero es lo que hace falta para que
// el CSS exista.

// El padre de esta pantalla (App.tsx) la mete en un contenedor de 480px fijo
// pensado para formularios/lobby angostos — a propósito para el resto de
// MultiplayerGame (RoundScreen, etc.), así que en vez de ensanchar ese
// contenedor compartido, solo la sala se "escapa" de él en desktop: se
// centra con su propio ancho vía margin-left 50% + translateX, ignorando el
// max-width del ancestro. Reusado en la grilla y en la barra de acción fija
// (mismo ancho en las dos).
const LOBBY_BREAKOUT = "min-[900px]:w-[calc(100vw-48px)] min-[900px]:max-w-[1100px] min-[900px]:ml-[50%] min-[900px]:-translate-x-1/2";

// Una columna en mobile (como antes), dos parejas desde el breakpoint:
// jugadores a la izquierda, configuración del juego activo a la derecha —
// mismo ancho para las dos porque el ConfigPanel de cada juego trae su
// propio contenido y necesita tanto aire como la grilla de jugadores.
const LOBBY_GRID = "block min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:gap-7";

// En mobile las columnas NO tienen techo — se alargan lo que haga falta y es
// la página la que scrollea. Desde el breakpoint de dos columnas sí hace
// falta un techo relativo al viewport (calc coincide con
// LOBBY_COL_MAX_HEIGHT_PX/reserva de useLobbyColumnMaxHeight.ts, que además
// mide el alto real disponible y lo aplica inline por ref).
const LOBBY_COL = "pr-2.5 -mr-2.5 min-[900px]:max-h-[min(600px,calc(100dvh-260px))] min-[900px]:overflow-y-auto";

// La columna derecha (ConfigPanel del juego / LobbyInfo del no-anfitrión)
// solo existe como columna real desde el breakpoint — abajo de eso, el mismo
// flujo apilado de siempre (`contents` no genera caja propia).
const LOBBY_SIDE = "contents min-[900px]:flex min-[900px]:flex-col";

const LOBBY_CONFIG_SCROLL =
  "pr-1 -mr-1 min-[900px]:flex-1 min-[900px]:min-h-0 min-[900px]:max-h-[min(600px,calc(100dvh-260px))] min-[900px]:overflow-y-auto";

// Sección de Configuración: cada juego trae su propio contenido (tabs,
// editores, selects), así que en vez de tocar cada uno se anima
// genéricamente cada bloque de primer nivel que ese contenido renderiza —
// entra en cascada y levita un poco al pasar el mouse.
const LOBBY_CONFIG_ANIM = clsx(
  "[&>*]:animate-[jt-rise_0.5s_cubic-bezier(0.22,1,0.36,1)_both] [&>*]:transition-transform [&>*]:duration-[220ms] [&>*:hover]:-translate-y-0.5",
  "[&>*:nth-child(1)]:[animation-delay:110ms] [&>*:nth-child(2)]:[animation-delay:150ms] [&>*:nth-child(3)]:[animation-delay:190ms]",
  "[&>*:nth-child(4)]:[animation-delay:230ms] [&>*:nth-child(n+5)]:[animation-delay:270ms]",
  "motion-reduce:[&>*]:animate-none motion-reduce:[&>*]:transition-none",
);

const LOBBY_GLOW_A =
  "absolute z-[-1] rounded-full pointer-events-none blur-[100px] opacity-60 left-[-8%] top-[-8%] w-[30vw] h-[30vw] max-w-[320px] max-h-[320px] min-w-[180px] min-h-[180px] bg-[color-mix(in_srgb,var(--jt-accent)_14%,transparent)]";

const LOBBY_ACTION_BAR =
  "fixed inset-x-0 bottom-0 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] bg-[linear-gradient(transparent,var(--jt-bg)_24%)] z-10 flex justify-center";

const LOBBY_ACTION_INNER = "max-w-[480px] w-full mx-auto min-[900px]:max-w-[1100px]";

const LOBBY_WAITING_CARD = clsx(
  "backdrop-blur-[6px] flex flex-col items-center gap-2.5",
  "transition-[transform,box-shadow,border-color] duration-[320ms] [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]",
  "hover:border-jt-accent-border-soft hover:shadow-[0_20px_50px_-24px_color-mix(in_srgb,var(--jt-accent)_45%,transparent)]",
);

const LOBBY_WAITING_DOT = "w-2 h-2 rounded-full bg-jt-accent animate-[jt-float_1.8s_ease-in-out_infinite] motion-reduce:animate-none";

// "Jugadores"/"Config" (mobile-only tabs, ver showLobbyTabs abajo): sin
// tabs ambas secciones siempre convivían visibles, así que sin tabs no hace
// falta ninguna clase de visibilidad — solo se oculta la no-activa en mobile
// cuando sí hay tabs, y desde el breakpoint las tabs desaparecen y las dos
// vuelven a convivir side-by-side.
function tabPanelClass(showTabs: boolean, isActiveTab: boolean): string {
  if (!showTabs) return "";
  return isActiveTab ? "block min-[900px]:block" : "hidden min-[900px]:block";
}

/**
 * Una sala independiente o el lobby de una instancia de grupo:
 * código de sala (solo standalone), lista de jugadores con acciones
 * host-only, el ConfigPanel/LobbyInfo propio del juego activo, y el botón
 * de inicio. Cubre connectionPhase "lobby" — extraído verbatim de
 * MultiplayerGame.tsx, que sigue siendo dueño de todo el estado de esta
 * pantalla.
 */
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
  // breakpoint de dos columnas ambas están siempre visibles lado a lado,
  // así que acá siempre se renderizan las dos y es tabPanelClass (no esta
  // condición) quien decide cuál tapar en mobile.
  const showLobbyTabs = isHost && !!activeGame?.tabbedLobby;
  // Estado propio de esta pantalla (a diferencia de showQR, que vive en
  // MultiplayerGame porque GroupScreen también lo usa) — "compartir enlace"
  // es una acción exclusiva de la sala, no necesita subir más arriba.
  const [showShareLink, setShowShareLink] = useState(false);
  const { seats, visibleSeats, hiddenSeatCount, visibleCount, showAllSeats, showMoreSeats, showFewerSeats } = useLobbySeats(room);

  const { colRef, configScrollRef, actionBarRef } = useLobbyColumnMaxHeight({
    lobbyTab,
    isHost,
    activeGameId: activeGame?.id,
    playerCount: room.players.length,
    maxPlayers: room.maxPlayers,
    visibleSeatCount: visibleCount,
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
        <p className={clsx(T.muted, "mt-2 text-center")}>Necesitás mínimo {activeGame?.minPlayers ?? 3} jugadores</p>
      ) : (
        notReadyReason && <p className="mt-2 text-center text-xs text-[#E2C44A]">{notReadyReason}</p>
      )}
    </>
  );

  return (
    <div className={clsx("relative mt-2 min-[900px]:mt-5", isHost && "pb-[88px]")}>
      <div className={clsx(LOBBY_GLOW_A, "jt-animate-drift")} aria-hidden="true" />
      <Toast message={statusToast} onExpire={onStatusToastExpire} />

      <div className={clsx(LOBBY_GRID, LOBBY_BREAKOUT)}>
        <div className={clsx(LOBBY_COL, "jt-thin-scrollbar")} ref={colRef}>
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
            <div className="mt-3.5 min-[900px]:hidden">
              <SetupTabs tab={lobbyTab} onChange={onLobbyTabChange} />
            </div>
          )}

          {
            <div className={clsx("jt-animate-rise mt-3.5 [animation-delay:60ms]", tabPanelClass(showLobbyTabs, lobbyTab === "players"))}>
              <LobbySeatGrid
                room={room}
                myPlayerId={myPlayerId}
                isHost={isHost}
                visibleSeats={visibleSeats}
                hiddenSeatCount={hiddenSeatCount}
                totalSeatCount={seats.length}
                showAllSeats={showAllSeats}
                onShowMoreSeats={showMoreSeats}
                onShowFewerSeats={showFewerSeats}
                openPlayerMenu={openPlayerMenu}
                onTogglePlayerMenu={onTogglePlayerMenu}
                onTransferHost={onTransferHost}
                onKickPlayer={onKickPlayer}
                onShowShareLink={setShowShareLink}
              />
            </div>
          }
        </div>

        <div className={clsx(LOBBY_SIDE, LOBBY_COL)}>
          {isHost && activeGame?.ConfigPanel && (
            <div
              ref={configScrollRef}
              className={clsx(
                "jt-animate-rise jt-thin-scrollbar [animation-delay:110ms]",
                LOBBY_CONFIG_ANIM,
                LOBBY_CONFIG_SCROLL,
                tabPanelClass(showLobbyTabs, lobbyTab === "config"),
              )}
            >
              <GameLoadErrorBoundary key={activeGame.id}>
                <Suspense fallback={null}>
                  <activeGame.ConfigPanel room={room} updateConfig={updateConfig} />
                </Suspense>
              </GameLoadErrorBoundary>
            </div>
          )}

          {/* Juego sin ConfigPanel (p. ej. Recámara, sin reglas
              configurables): la columna de config quedaría vacía moviendo el
              layout igual que si hubiera contenido, así que mostramos la
              descripción + reglas del juego a modo de recordatorio — mismo
              rol informativo que el ConfigPanel de los demás, sin inventar
              controles que no existen. */}
          {isHost && !activeGame?.ConfigPanel && (activeGame?.description || activeGame?.rules?.length) && (
            <div
              ref={configScrollRef}
              className={clsx(
                "jt-animate-rise jt-thin-scrollbar [animation-delay:110ms]",
                LOBBY_CONFIG_SCROLL,
                tabPanelClass(showLobbyTabs, lobbyTab === "config"),
              )}
            >
              <div className={clsx(T.card, "text-left")}>
                {activeGame?.description && <p className="m-0 text-[15px] text-[#9089c0]">{activeGame.description}</p>}
                {!!activeGame?.rules?.length && (
                  <ul className="m-0 mt-2.5 pl-4 text-sm text-[#9089c0] space-y-1">
                    {activeGame.rules.map((rule, i) => (
                      <li key={i}>{rule.startsWith("- ") ? rule.slice(2) : rule}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {!isHost && (
            <div ref={configScrollRef} className={clsx("jt-animate-rise jt-thin-scrollbar [animation-delay:110ms]", LOBBY_CONFIG_SCROLL)}>
              {activeGame?.LobbyInfo && (
                <GameLoadErrorBoundary key={activeGame.id}>
                  <Suspense fallback={null}>
                    <activeGame.LobbyInfo room={room} />
                  </Suspense>
                </GameLoadErrorBoundary>
              )}
              <div className={clsx(LOBBY_WAITING_CARD, "text-center", T.card)}>
                <span className={LOBBY_WAITING_DOT} />
                <p className="m-0 text-[15px] text-[#9089c0]">Esperando que el anfitrión inicie la partida</p>
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
          <div ref={actionBarRef} className={clsx(LOBBY_ACTION_BAR, LOBBY_BREAKOUT)}>
            <div className={clsx(LOBBY_ACTION_INNER, "jt-animate-rise [animation-delay:160ms]")}>
              <ErrorBanner message={error} flashKey={errorKey} variant="inline" />
              {startAction}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
