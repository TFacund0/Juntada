import { useEffect, useRef } from "react";

/**
 * Scrollea el contenedor de mensajes hasta el final cada vez que cambian
 * las `deps` dadas (típicamente `[open, activeChannel?.messages.length]`) —
 * extraído de FloatingChat.tsx verbatim. Firma con deps sueltas en vez del
 * patrón `Use*Args`/`Use*Result` del resto de los hooks del feature: acá no
 * hay nada que envolver, es un ref y un efecto de 3 líneas.
 */
export function useAutoScrollToBottom(deps: readonly unknown[]): React.RefObject<HTMLDivElement | null> {
  const msgsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return msgsRef;
}
