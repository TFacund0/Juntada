import { useState } from "react";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";

/**
 * La grilla muestra un "lugar" por cada cupo de la sala, no solo por
 * jugador ya sentado — los cupos libres quedan como chip vacío punteado,
 * así se ve de un vistazo cuánto falta llenar. Colapsado por defecto a 5
 * lugares (jugadores primero, después vacíos) con un "+N" que despliega
 * el resto — evita que un maxPlayers alto (hasta 20 en algunos juegos)
 * empuje toda la columna para abajo antes de llegar a la config/inicio.
 */
export function useLobbySeats(room: RoomPublicState) {
  const [showAllSeats, setShowAllSeats] = useState(false);
  const emptySeatCount = Math.max(0, room.maxPlayers - room.players.length);
  const seats: Array<{ kind: "player"; player: PublicPlayer } | { kind: "empty"; key: string }> = [
    ...room.players.map(player => ({ kind: "player" as const, player })),
    ...Array.from({ length: emptySeatCount }, (_, i) => ({ kind: "empty" as const, key: `empty-${i}` })),
  ];
  const visibleSeats = showAllSeats ? seats : seats.slice(0, 5);
  const hiddenSeatCount = seats.length - visibleSeats.length;

  return { seats, visibleSeats, hiddenSeatCount, showAllSeats, setShowAllSeats };
}
