import { createContext, useContext } from "react";
import type { RayadoSfx } from "./useRayadoSfx";

/**
 * El sonido del juego, montado una sola vez en RoundView (online) o LocalGame
 * (local) y leído por cada pieza que suena (paleta, reloj, abanico, podio…)
 * en vez de pasarlo prop por prop por todas las pantallas intermedias.
 */
export const RayadoSfxContext = createContext<RayadoSfx | undefined>(undefined);

export function useRayadoSfxContext(): RayadoSfx {
  const sfx = useContext(RayadoSfxContext);
  if (sfx === undefined) throw new Error("useRayadoSfxContext must be used within RayadoSfxContext.Provider");
  return sfx;
}
