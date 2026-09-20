import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { Avatar } from "../../../components/ui/Avatar";
import type { RoomPublicState } from "@juntada/shared-types";

/**
 * Pantalla para quien se unió a una sala/instancia con una ronda ya en
 * curso (ver roomService.joinRoom/joinInstanceRoom: en vez de rechazarlo,
 * queda en room.waitingPlayers). No hay nada que jugar todavía — solo
 * espera a que la ronda actual termine y la sala vuelva al lobby, momento
 * en el que el servidor lo mueve a `players` y esta pantalla deja de
 * mostrarse sola por el cambio de fase.
 */
export function WaitingScreen({ room }: { room: RoomPublicState }) {
  const waitingPlayers = room.waitingPlayers ?? [];
  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center gap-4 px-4 pt-10 text-center">
      <div className="text-4xl">⏳</div>
      <h2 className={clsx(T.title, "text-2xl")}>Esperando a que termine la ronda</h2>
      <p className={T.muted}>{room.name} ya está jugando. Vas a entrar automáticamente apenas termine esta ronda.</p>
      <div className={clsx(T.card, "mb-0 w-full")}>
        <div className="mb-2.5 flex items-center justify-between">
          <span className={clsx(T.label, "mb-0")}>Jugando ahora</span>
          <span className={T.pill(false)}>
            {room.players.length} / {room.maxPlayers}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {room.players.map(p => (
            <div key={p.id} className="flex flex-col items-center gap-1" style={{ opacity: p.online ? 1 : 0.5 }}>
              <Avatar name={p.name} size={40} />
              <span className="max-w-[70px] truncate text-xs">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
      {waitingPlayers.length > 1 && (
        <p className={T.muted}>
          {waitingPlayers.length - 1} jugador{waitingPlayers.length - 1 === 1 ? "" : "es"} más esperando con vos.
        </p>
      )}
    </div>
  );
}
