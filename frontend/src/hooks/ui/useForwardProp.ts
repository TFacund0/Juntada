import { useEffect, useLayoutEffect } from "react";

/**
 * Reenvía `value` hacia un callback opcional del padre cada vez que cambia
 * (o cuando cambia la identidad de `cb`), replicando `useEffect(() =>
 * cb?.(value), [value, cb])`. Con `clearOnUnmount: true`, además llama a
 * `cb(null)` en el cleanup del unmount — usado por el único caso que expone
 * un valor nullable hacia arriba (`gameType`).
 *
 * `sync: true` usa `useLayoutEffect` en vez de `useEffect` — necesario para
 * `gameType` (ver `useMultiplayerGameShell.ts`): un `useEffect` corre (y
 * pinta) recién en el commit SIGUIENTE al que ya cambió `room`/
 * `connectionPhase` (esos sí sincrónicos con el mensaje del servidor que
 * confirma la salida de la instancia), así que la pantalla de grupo llegaba
 * a pintarse un frame entero con el tema del juego anterior todavía puesto
 * (`--jt-accent`/fondo de `useGameTheme`, que reacciona recién cuando este
 * reenvío hace que `gameId` baje a `null`) — un flash visible de "volver al
 * grupo" mostrando los colores del juego por un instante. Con `sync`, este
 * reenvío corre en la misma fase de layout que ese cambio, antes de pintar.
 * El resto de los reenvíos (código de sala/grupo, fase, adjunto al grupo) no
 * maneja nada visual tan sensible al orden, así que quedan con el
 * `useEffect` de siempre por defecto.
 */
export function useForwardProp<T>(value: T, cb: ((v: T) => void) | undefined, opts?: { clearOnUnmount?: boolean; sync?: boolean }): void {
  const useEffectHook = opts?.sync ? useLayoutEffect : useEffect;
  useEffectHook(() => {
    cb?.(value);
    // `opts` se lee acá adentro pero se excluye deliberadamente de las deps:
    // un objeto literal inline en cada render no debe volver a disparar el
    // efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return opts?.clearOnUnmount ? () => cb?.(null as T) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, cb]);
}
