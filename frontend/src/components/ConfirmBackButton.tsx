import { useState } from "react";
import { BackButton } from "./BackButton";
import { ConfirmDialog } from "./ConfirmDialog";

// A BackButton that asks for confirmation before firing — for any
// destructive-ish "leave/end/reset" action (back to lobby, end a local
// match, ...) shown at the bottom of a result screen. Same ghost styling as
// a plain BackButton everywhere, local or online, so games don't each
// reinvent their own confirm-dialog-plus-boolean-state wiring.
export function ConfirmBackButton({
  children,
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  children: string;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <BackButton onClick={() => setConfirming(true)}>{children}</BackButton>
      {confirming && (
        <ConfirmDialog
          title={title}
          message={message}
          confirmLabel={confirmLabel ?? children}
          onConfirm={() => {
            setConfirming(false);
            onConfirm();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
