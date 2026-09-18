import { Suspense } from "react";
import { isGameAvailable } from "../../games/maintenance";
import { GameLoadErrorBoundary } from "../../components/shell/GameLoadErrorBoundary";
import { GameLoading } from "./GameLoading";
import { useGameSessionContext } from "../context/GameSessionContext";

// Juego solo local (sin motor de sala online, game.localOnly === true):
// directo al juego, sin pasar por ModePicker — extraído verbatim del bloque
// `gameId && game?.localOnly && isGameAvailable(game) && !mode` en App.tsx.
// A diferencia de LocalGamePage, no expone onExposeBack/onExposeReset (el
// bloque original tampoco lo hacía). Guard preservado tal cual — ver nota de
// "one-render lag" en design.md.
export function LocalOnlyGamePage() {
  const { gameId, mode, game } = useGameSessionContext();

  if (!(gameId && game?.localOnly && isGameAvailable(game) && !mode)) return null;

  return (
    <GameLoadErrorBoundary key={gameId}>
      <Suspense fallback={<GameLoading />}>
        <game.LocalGame />
      </Suspense>
    </GameLoadErrorBoundary>
  );
}
