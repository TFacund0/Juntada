import clsx from "clsx";
import { T } from "../../../../theme/styles/classes";
import { PlayerChip } from "../PlayerChip";
import { SEAT_REVEAL_STEP } from "../../hooks/useLobbySeats";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";

// Grilla "lugares" (jugador o cupo vacío), 2 columnas en mobile y 3 desde
// 480px — representa cupos de sala, no solo jugadores conectados, así que
// las columnas quedan parejas de ancho fijo. Techo de 290px + scroll propio
// desde el breakpoint de dos columnas (900px, LobbyScreen.tsx mide el real
// disponible de la columna entera) para que "Ver más" con un maxPlayers
// alto no empuje a la columna de Config al lado.
const PLAYER_GRID =
  "grid grid-cols-2 min-[480px]:grid-cols-3 gap-2.5 pr-1 -mr-1 min-[900px]:max-h-[290px] min-[900px]:overflow-y-auto [&>*]:h-[122px] [&>*]:box-border";

// Lugar vacío — mismas proporciones que PlayerChip pero punteado/apagado,
// para leerse como "todavía no hay nadie" en vez de un jugador más.
const EMPTY_SEAT =
  "flex items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-jt-card-border text-jt-muted-text text-xs font-bold opacity-70 m-0 p-0 w-full font-[inherit] transition-[transform,border-color,background] duration-[220ms]";

// Invitable (sala sin grupo): al hover se levanta, borde pasa a sólido con
// acento, y el label crossfadea "Vacío" -> "Invitar" (via `group`).
const INVITABLE_EMPTY_SEAT = clsx(
  EMPTY_SEAT,
  "group cursor-pointer hover:-translate-y-[3px] hover:border-solid hover:border-jt-accent hover:bg-jt-accent-soft hover:text-jt-accent-strong",
);

// Tile "+N Ver más"/"Ver menos" — mismas proporciones que un PlayerChip
// pero borde punteado y sin avatar, para leerse como acción, no persona.
const MORE_SEATS_TILE =
  "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-[14px] border-[1.5px] border-dashed border-jt-accent-border-soft font-[inherit] text-[11px] font-bold text-jt-accent-strong cursor-pointer transition-[transform,border-color] duration-[220ms] hover:-translate-y-0.5 hover:border-jt-accent";

/**
 * Grilla de "lugares" del lobby: un chip por jugador sentado + un chip
 * vacío (punteado) por cada cupo libre, colapsada a 5 con "+N / Ver
 * menos". Extraído verbatim de LobbyScreen.tsx (bloque "Jugadores"), que
 * sigue siendo dueño del estado de `useLobbySeats` y lo pasa acá ya
 * derivado — este componente no conoce refs de layout (no está dentro
 * del createPortal ni de las columnas con maxHeight).
 */
export function LobbySeatGrid({
  room,
  myPlayerId,
  isHost,
  visibleSeats,
  hiddenSeatCount,
  totalSeatCount,
  showAllSeats,
  onShowMoreSeats,
  onShowFewerSeats,
  openPlayerMenu,
  onTogglePlayerMenu,
  onTransferHost,
  onKickPlayer,
  onShowShareLink,
}: {
  room: RoomPublicState;
  myPlayerId: string | undefined;
  isHost: boolean;
  visibleSeats: Array<{ kind: "player"; player: PublicPlayer } | { kind: "empty"; key: string }>;
  hiddenSeatCount: number;
  totalSeatCount: number;
  showAllSeats: boolean;
  onShowMoreSeats: () => void;
  onShowFewerSeats: () => void;
  openPlayerMenu: string | null;
  onTogglePlayerMenu: (id: string | null) => void;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
  onShowShareLink: (show: boolean) => void;
}) {
  return (
    <>
      <div className="mx-0.5 mb-2.5 mt-0 flex items-center justify-between">
        <span className={clsx(T.label, "mb-0")}>Jugadores</span>
        <span className={T.pill(false)}>
          {room.players.length} / {room.maxPlayers}
        </span>
      </div>
      <div className={clsx("backdrop-blur-[6px]", T.card)}>
        <div className={clsx(PLAYER_GRID, "jt-thin-scrollbar")}>
          {visibleSeats.map((seat, i) =>
            seat.kind === "player" ? (
              <PlayerChip
                key={seat.player.id}
                player={seat.player}
                isMe={seat.player.id === myPlayerId}
                isHostPlayer={seat.player.id === room.hostId}
                canManage={isHost && seat.player.id !== myPlayerId}
                menuOpen={openPlayerMenu === seat.player.id}
                onToggleMenu={onTogglePlayerMenu}
                onTransferHost={onTransferHost}
                onKickPlayer={onKickPlayer}
                animationDelay={i * 40}
              />
            ) : room.groupCode === null ? (
              <button
                key={seat.key}
                type="button"
                onClick={() => onShowShareLink(true)}
                className={clsx(INVITABLE_EMPTY_SEAT, "jt-animate-rise")}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className="relative inline-block">
                  <span className="transition-opacity duration-[180ms] group-hover:opacity-0">Vacío</span>
                  <span className="absolute inset-0 opacity-0 transition-opacity duration-[180ms] group-hover:opacity-100">Invitar</span>
                </span>
              </button>
            ) : (
              <div key={seat.key} className={clsx(EMPTY_SEAT, "jt-animate-rise")} style={{ animationDelay: `${i * 40}ms` }}>
                Vacío
              </div>
            ),
          )}
          {hiddenSeatCount > 0 && (
            <button className={MORE_SEATS_TILE} onClick={onShowMoreSeats}>
              <span className="text-lg font-extrabold">+{Math.min(SEAT_REVEAL_STEP, hiddenSeatCount)}</span>
              Ver más
            </button>
          )}
          {showAllSeats && totalSeatCount > 5 && (
            <button className={MORE_SEATS_TILE} onClick={onShowFewerSeats}>
              Ver menos
            </button>
          )}
        </div>
      </div>
    </>
  );
}
