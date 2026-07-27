import { ConfirmBackButton } from "./ConfirmBackButton";

// Every online RoundView needs this same "back_to_lobby" exit, hidden inside
// a group (the shell's persistent "Volver al grupo" link covers that case
// instead) — available to any player, not just the host. Always confirms:
// this is only ever rendered mid-round or on the result screen, never from
// the lobby itself, so there's always a match in progress to interrupt for
// everyone. `message` only needs overriding when a game's wording genuinely
// differs from the shared default (e.g. no persistent score to lose, or a
// strictly-2-player match) — most games can just take the default instead
// of hand-writing the same sentence again.
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
