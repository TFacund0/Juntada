import { useOutletContext } from "react-router-dom";
import { isGameAvailable } from "../../games/maintenance";
import { ModePicker } from "../../components/shell/ModePicker";
import type { AppOutletContext } from "../AppOutletContext";

// Paso 2: elegir modo (solo si el juego ya está implementado y soporta
// online) — extraído verbatim del bloque
// `gameId && !mode && game && isGameAvailable(game) && !game.localOnly` en
// App.tsx. Guard preservado tal cual — ver nota de "one-render lag" en
// design.md.
export function ModePickerPage() {
  const { gameId, mode, game, setMode, withCurtain } = useOutletContext<AppOutletContext>();

  if (!(gameId && !mode && game && isGameAvailable(game) && !game.localOnly)) return null;

  return (
    <ModePicker
      onSelectMulti={() => setMode("multi")}
      onSelectLocal={() => withCurtain(() => setMode("local"), Boolean(game?.gameTheme))}
    />
  );
}
