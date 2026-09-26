import { useCallback, useRef } from "react";
import { shouldSendTyping } from "../utils/typing";

export interface TypingSignal {
  /** Llamar en cada cambio del input: avisa "escribiendo" como mucho cada 2 s, y solo con texto. */
  onInput: (text: string) => void;
  /** Llamar al mandar un intento: el servidor apaga el indicador, así el próximo aviso sale enseguida. */
  reset: () => void;
}

/**
 * Del lado de quien escribe: manda `{ type: "typing" }` al teclear, con un
 * mínimo de 2 s entre avisos. `enabled` es falso para quien dibuja y para
 * quien ya adivinó (el servidor igual los ignoraría).
 */
export function useTypingSignal(enabled: boolean, sendTyping: () => void): TypingSignal {
  const lastSentAt = useRef<number | null>(null);
  const onInput = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return;
      const now = Date.now();
      if (!shouldSendTyping(lastSentAt.current, now)) return;
      lastSentAt.current = now;
      sendTyping();
    },
    [enabled, sendTyping],
  );
  const reset = useCallback(() => {
    lastSentAt.current = null;
  }, []);
  return { onInput, reset };
}
