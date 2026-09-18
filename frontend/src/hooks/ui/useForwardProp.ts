import { useEffect } from "react";

/**
 * Reenvía `value` hacia un callback opcional del padre cada vez que cambia
 * (o cuando cambia la identidad de `cb`), replicando `useEffect(() =>
 * cb?.(value), [value, cb])`. Con `clearOnUnmount: true`, además llama a
 * `cb(null)` en el cleanup del unmount — usado por el único caso que expone
 * un valor nullable hacia arriba (`gameType`).
 */
export function useForwardProp<T>(value: T, cb: ((v: T) => void) | undefined, opts?: { clearOnUnmount?: boolean }): void {
  useEffect(() => {
    cb?.(value);
    // `opts` se lee acá adentro pero se excluye deliberadamente de las deps:
    // un objeto literal inline en cada render no debe volver a disparar el
    // efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return opts?.clearOnUnmount ? () => cb?.(null as T) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cb]);
}
