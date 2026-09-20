import { useState } from "react";
import clsx from "clsx";
import { T } from "../../../theme/styles/classes";
import { ConfirmDialog } from "../../../components/dialogs/ConfirmDialog";

// Small, red, and easy to ignore on purpose — ending the match early is the
// exception, not something to push players toward. Owns its own confirm-
// dialog state since it's just transient UI, not game state the parent
// needs to reset elsewhere.
export function EndMatchButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button onClick={() => setConfirming(true)} className={clsx(T.btn("danger"), "w-auto! px-3.5 py-1.5 text-xs")}>
        Terminar partida
      </button>
      {confirming && (
        <ConfirmDialog
          title="¿Terminar la partida?"
          message="Se corta el juego ahora y se muestra el resultado tal como está."
          confirmLabel="Terminar partida"
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
