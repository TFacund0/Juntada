import { useCallback, useRef, useState } from "react";

/**
 * Comportamiento compartido para un mensaje transitorio de error/validación:
 * setearlo con un string no vacío incrementa `errorKey` (para que la
 * animación de destello de `ErrorBanner` se repita incluso ante un mensaje
 * idéntico repetido, ej. reintentar el mismo nombre duplicado dos veces
 * seguidas) y se auto-limpia después de `duration` ms; setearlo con `""` lo
 * limpia al instante.
 *
 * @param duration milisegundos antes de auto-limpiarse (por defecto 4000).
 * @returns tupla `[error, errorKey, setError]`.
 */
export function useFlashError(duration = 4000) {
  const [error, setErrorState] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setError = useCallback(
    (message: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setErrorState(message);
      if (message) {
        setErrorKey(k => k + 1);
        timeoutRef.current = setTimeout(() => setErrorState(""), duration);
      }
    },
    [duration],
  );

  return [error, errorKey, setError] as const;
}
