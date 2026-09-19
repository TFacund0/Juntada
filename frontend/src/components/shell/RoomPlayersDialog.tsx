import { useState } from "react";
import { DialogFrame } from "../dialogs/DialogFrame";
import { LobbySeatGrid } from "../../features/multiplayer/components/lobby/LobbySeatGrid";
import { useLobbySeats } from "../../features/multiplayer/hooks/useLobbySeats";
import type { RoomRoster } from "../../pages/context/GameSessionContext";

const TITLE_ID = "jt-room-players-title";

/**
 * Panel "Jugadores" accesible desde el navbar de cualquier juego (ver
 * GameNavbar), en cualquier fase (lobby o ronda) — no solo mientras
 * LobbyScreen está montada. Reusa LobbySeatGrid tal cual (mismo componente
 * que ya muestra online/offline, host, y el menú de transferir/expulsar
 * host-only vía PlayerChip) en vez de duplicar esa UI; la única pieza nueva
 * acá es el marco de diálogo y el estado de qué menú está abierto.
 *
 * `onShowShareLink` de LobbySeatGrid queda como no-op a propósito: invitar
 * gente nueva no es el propósito de este panel mid-partida, y la sala ya
 * tiene su propio flujo de invitación en el lobby.
 */
export function RoomPlayersDialog({
  roster,
  onClose,
  onTransferHost,
  onKickPlayer,
}: {
  roster: RoomRoster;
  onClose: () => void;
  onTransferHost: (id: string) => void;
  onKickPlayer: (id: string) => void;
}) {
  const { room, myPlayerId } = roster;
  const isHost = myPlayerId != null && myPlayerId === room.hostId;
  const { visibleSeats, hiddenSeatCount, seats, showAllSeats, showMoreSeats, showFewerSeats } = useLobbySeats(room);
  const [openPlayerMenu, setOpenPlayerMenu] = useState<string | null>(null);

  return (
    <DialogFrame onClose={onClose} titleId={TITLE_ID} maxWidth={420} textAlign="left">
      <h2 id={TITLE_ID} className="m-0 mb-3 text-[15px] font-extrabold text-white">
        Jugadores
      </h2>
      <LobbySeatGrid
        room={room}
        myPlayerId={myPlayerId ?? undefined}
        isHost={isHost}
        visibleSeats={visibleSeats}
        hiddenSeatCount={hiddenSeatCount}
        totalSeatCount={seats.length}
        showAllSeats={showAllSeats}
        onShowMoreSeats={showMoreSeats}
        onShowFewerSeats={showFewerSeats}
        openPlayerMenu={openPlayerMenu}
        onTogglePlayerMenu={setOpenPlayerMenu}
        onTransferHost={onTransferHost}
        onKickPlayer={onKickPlayer}
        onShowShareLink={() => {}}
      />
    </DialogFrame>
  );
}
