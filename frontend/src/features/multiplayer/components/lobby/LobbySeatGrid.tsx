import { S } from "../../../../theme/styles";
import { PlayerChip } from "../PlayerChip";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";

// Grilla de "lugares" del lobby: un chip por jugador sentado + un chip
// vacío (punteado) por cada cupo libre, colapsada a 5 con "+N / Ver
// menos". Extraído verbatim de LobbyScreen.tsx (bloque "Jugadores"), que
// sigue siendo dueño del estado de `useLobbySeats` y lo pasa acá ya
// derivado — este componente no conoce refs de layout (no está dentro
// del createPortal ni de las columnas con maxHeight).
export function LobbySeatGrid({
  room,
  myPlayerId,
  isHost,
  visibleSeats,
  hiddenSeatCount,
  totalSeatCount,
  showAllSeats,
  onShowAllSeats,
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
  onShowAllSeats: (show: boolean) => void;
  openPlayerMenu: string | null;
  onTogglePlayerMenu: (id: string | null) => void;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
  onShowShareLink: (show: boolean) => void;
}) {
  return (
    <>
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
            <button className="jt-player-chip-more" onClick={() => onShowAllSeats(true)}>
              <span className="jt-player-chip-more-count">+{hiddenSeatCount}</span>
              Ver todos
            </button>
          )}
          {showAllSeats && totalSeatCount > 5 && (
            <button className="jt-player-chip-more" onClick={() => onShowAllSeats(false)}>
              Ver menos
            </button>
          )}
        </div>
      </div>
    </>
  );
}
