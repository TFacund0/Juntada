import { useState } from "react";
import { getGame } from "../../../games/registry";
import { consumeJoinLink } from "../utils/joinLink";

/**
 * Consume, una sola vez, un link de "unirse" pendiente en la URL actual
 * (`?join=CODE&game=id` para una sala, o `?join=CODE&kind=group` para un
 * grupo).
 *
 * Un link escaneado siempre gana por sobre una sesión activa restaurada: si
 * el jugador escaneó un QR explícitamente, la intención es ir ahí, no volver
 * a donde estaba antes. Se calcula una sola vez (inicializador perezoso de
 * `useState`) porque `consumeJoinLink()` limpia la URL como efecto colateral
 * y no debe volver a ejecutarse en cada render. Un link de grupo no trae
 * juego — el juego recién se sabe cuando el jugador elige (o se une a) uno
 * desde adentro del grupo.
 */
export function useValidJoinLink() {
  const [validJoinLink] = useState(() => {
    const link = consumeJoinLink();
    if (!link) return null;
    if (link.kind === "room" && !getGame(link.gameId)) return null;
    return link;
  });
  return validJoinLink;
}
