import { useRef } from "react";

/**
 * Para animar solo lo que aparece en vivo (un mensaje, una fichita): dice si
 * cada clave es "nueva de verdad". Lo que ya estaba al montar (volver a la
 * pantalla, reconectar) nunca cuenta, y lo que llega mientras la pestaña
 * está oculta o recién vuelve tampoco (`canAnimate`, ver useAnimationGate):
 * se muestra el estado actual sin reproducir animaciones atrasadas.
 *
 * La decisión se toma una sola vez por clave y queda fija, así un re-render
 * no la cambia ni vuelve a disparar la animación.
 */
export function useFreshKeys(keys: readonly string[], canAnimate: () => boolean): (key: string) => boolean {
  const decided = useRef<Map<string, boolean> | null>(null);
  if (decided.current === null) decided.current = new Map(keys.map(k => [k, false]));
  const map = decided.current;
  for (const k of keys) if (!map.has(k)) map.set(k, canAnimate());
  return key => map.get(key) ?? false;
}
