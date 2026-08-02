import { useState } from "react";
import { BackButton } from "./BackButton";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";

/**
 * Un `BackButton` que pide confirmación antes de dispararse — para
 * cualquier acción medio destructiva de "salir/terminar/reiniciar" (volver
 * al lobby, terminar una partida local, ...) mostrada al pie de una
 * pantalla de resultado. Mismo estilo ghost que un `BackButton` plano en
 * todos lados, local u online, así los juegos no reinventan cada uno su
 * propio manejo de diálogo-de-confirmación-más-estado-booleano.
 */
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
