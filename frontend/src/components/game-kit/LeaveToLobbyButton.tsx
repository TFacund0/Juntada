import { ConfirmBackButton } from "./ConfirmBackButton";

/**
 * Todo `RoundView` online necesita esta misma salida de "back_to_lobby",
 * oculta dentro de un grupo (el link persistente "Volver al grupo" del
 * shell cubre ese caso en su lugar) — disponible para cualquier jugador,
 * no solo el host. Siempre pide confirmación: esto solo se renderiza a
 * mitad de ronda o en la pantalla de resultado, nunca desde el lobby en
 * sí, así que siempre hay una partida en curso que se interrumpe para
 * todos. `message` solo hace falta sobreescribirlo cuando la redacción de
 * un juego realmente difiere del texto compartido por defecto (ej. sin
 * puntaje persistente que perder, o una partida estrictamente de 2
 * jugadores) — la mayoría de los juegos puede simplemente usar el default
 * en vez de reescribir la misma oración a mano.
 */
const DEFAULT_MESSAGE = "Se interrumpe la partida para todos y se pierde el progreso.";

export function LeaveToLobbyButton({
  groupCode,
  send,
  message = DEFAULT_MESSAGE,
}: {
  groupCode: string | null;
  send: (msg: { type: string }) => void;
  message?: string;
}) {
  if (groupCode !== null) return null;
  return (
    <ConfirmBackButton
      title="¿Volver al lobby?"
      message={message}
      confirmLabel="Volver al lobby"
      onConfirm={() => send({ type: "back_to_lobby" })}
    >
      Volver al lobby
    </ConfirmBackButton>
  );
}
