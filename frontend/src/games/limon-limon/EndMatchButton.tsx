import { useState } from "react";
import { S } from "../../theme/styles";
import { ConfirmDialog } from "../../components/ConfirmDialog";

// Small, red, and easy to ignore on purpose — ending the match early is the
// exception, not something to push players toward. Owns its own confirm-
// dialog state since it's just transient UI, not game state the parent
// needs to reset elsewhere.
export function EndMatchButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <button onClick={() => setConfirming(true)} style={{ ...S.btn("danger"), width: "auto", padding: "6px 14px", fontSize: 12 }}>
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
