import { BackButton } from "./BackButton";
import { ConfirmBackButton } from "./ConfirmBackButton";

// Every online RoundView needs this same "back_to_lobby" exit, hidden inside
// a group (the shell's persistent "Volver al grupo" link covers that case
// instead) — available to any player, not just the host. Some games ask for
// confirmation first (interrupts the match for everyone); pass `confirm` to
// get that, or omit it for a plain, unconfirmed back button.
export function LeaveToLobbyButton({
  groupCode,
  send,
  confirm,
}: {
  groupCode: string | null;
  send: (msg: { type: string }) => void;
  confirm?: { message: string; title?: string; confirmLabel?: string };
}) {
  if (groupCode !== null) return null;
  if (!confirm) return <BackButton onClick={() => send({ type: "back_to_lobby" })}>Volver al lobby</BackButton>;
  return (
    <ConfirmBackButton
      title={confirm.title ?? "¿Volver al lobby?"}
      message={confirm.message}
      confirmLabel={confirm.confirmLabel ?? "Volver al lobby"}
      onConfirm={() => send({ type: "back_to_lobby" })}
    >
      Volver al lobby
    </ConfirmBackButton>
  );
}
