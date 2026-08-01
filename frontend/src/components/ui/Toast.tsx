import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./Toast.css";

const EXIT_MS = 200;

/**
 * Un banner breve que se auto-cierra (ej. "X se desconectó") — el padre es
 * dueño del estado del mensaje, pero este componente retiene el último
 * mensaje un instante más para poder reproducir su propia salida (en vez de
 * desaparecer de golpe en el mismo tick en que el padre limpia el estado) y
 * recién ahí llama a `onExpire`. No renderiza nada cuando no hay nada que
 * mostrar, así quien lo usa puede montarlo incondicionalmente.
 *
 * Portal a document.body: se monta desde LobbyScreen/RoundScreen, ambos
 * colgando del <ScreenFade> de App.tsx, que anima con `transform` durante
 * 0.32s al entrar a la pantalla — un toast que aparece justo en ese instante
 * (ej. un error de join) quedaría atrapado por ese `transform` y mal ubicado
 * en vez de fijo al viewport. Mismo motivo que RoomEntryModal/GroupEntryModal.
 */
export function Toast({ message, duration = 3000, onExpire }: { message: string | null; duration?: number; onExpire: () => void }) {
  const [shown, setShown] = useState(message);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!message) return;
    setShown(message);
    setPhase("in");
    const t = setTimeout(() => setPhase("out"), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  useEffect(() => {
    if (phase !== "out" || !shown) return;
    const t = setTimeout(onExpire, EXIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shown]);

  if (!shown) return null;

  return createPortal(
    <div
      className={phase === "out" ? "jt-toast jt-toast--out" : "jt-toast jt-toast--in"}
      style={{ animationDuration: phase === "out" ? `${EXIT_MS}ms` : undefined }}
    >
      <span aria-hidden className="jt-toast-dot" />
      {shown}
    </div>,
    document.body,
  );
}
