import { useState } from "react";
import type { RoomPublicState, PublicPlayer } from "@juntada/shared-types";

/**
 * La grilla muestra un "lugar" por cada cupo de la sala, no solo por
 * jugador ya sentado — los cupos libres quedan como chip vacío punteado,
 * así se ve de un vistazo cuánto falta llenar. Colapsado por defecto a 5
 * lugares (jugadores primero, después vacíos); "Ver más" no salta a
 * mostrar todo de golpe (un maxPlayers de 20 movería la columna entera de
 * un tirón) — suma de a 3 por click hasta llegar al total. "Ver menos"
 * vuelve directo a los 5 iniciales.
 */
export type Seat = { kind: "player"; player: PublicPlayer } | { kind: "empty"; key: string };

const BASE_VISIBLE_SEATS = 5;
export const SEAT_REVEAL_STEP = 3;

export function useLobbySeats(room: RoomPublicState) {
  const [visibleCount, setVisibleCount] = useState(BASE_VISIBLE_SEATS);
  const emptySeatCount = Math.max(0, room.maxPlayers - room.players.length);
  const seats: Seat[] = [
    ...room.players.map(player => ({ kind: "player" as const, player })),
    ...Array.from({ length: emptySeatCount }, (_, i) => ({ kind: "empty" as const, key: `empty-${i}` })),
  ];
  const visibleSeats = seats.slice(0, visibleCount);
  const hiddenSeatCount = seats.length - visibleSeats.length;
  const showAllSeats = visibleCount > BASE_VISIBLE_SEATS;

  const showMoreSeats = () => setVisibleCount(c => Math.min(seats.length, c + SEAT_REVEAL_STEP));
  const showFewerSeats = () => setVisibleCount(BASE_VISIBLE_SEATS);

  return { seats, visibleSeats, hiddenSeatCount, visibleCount, showAllSeats, showMoreSeats, showFewerSeats };
}
