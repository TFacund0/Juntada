import { useEffect, useRef } from "react";

/**
 * Devuelve el valor de `value` en el render anterior (`undefined` en el
 * primero). Implementación basada en efecto (no en mutar el ref durante el
 * render) para que sea segura bajo StrictMode's doble-invocación.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
