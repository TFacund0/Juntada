import { useOutletContext } from "react-router-dom";
import type { GameDef } from "../../games/gameTypes";
import { isGameAvailable } from "../../games/maintenance";
import { GamePicker } from "../../components/shell/gamePicker/GamePicker";
import { Hero } from "../../components/shell/Hero";
import type { AppOutletContext } from "../AppOutletContext";

// Paso 1: elegir juego — extraído verbatim del bloque `!gameId && !groupFlow`
// en App.tsx. Guard preservado tal cual: si por un "one-render lag" esta
// ruta sigue montada un render después de que gameId/groupFlow ya cambiaron,
// no debe volver a mostrar el picker — ver design.md.
export function PickerPage() {
  const { gameId, groupFlow, GAME_LIST, pickGame } = useOutletContext<AppOutletContext>();

  if (gameId || groupFlow) return null;

  return (
    <div>
      <Hero gameCount={(GAME_LIST as GameDef[]).filter(isGameAvailable).length} />
      <div id="jt-games">
        <GamePicker games={GAME_LIST as GameDef[]} onPick={pickGame} />
      </div>
    </div>
  );
}
