import { Suspense } from "react";
import { useOutletContext } from "react-router-dom";
import { GameLoadErrorBoundary } from "../components/shell/GameLoadErrorBoundary";
import { GameLoading } from "./GameLoading";
import type { AppOutletContext } from "./AppOutletContext";

// Paso 3 (mode === "local"): jugar un juego que sí soporta online pero fue
// elegido en modo local — extraído verbatim del bloque `mode === "local" &&
// game` en App.tsx. NO es lo mismo que LocalOnlyGamePage (juegos
// game.localOnly === true, ver ese archivo): este bloque expone
// onExposeBack/onExposeReset al header/diálogos globales, el de localOnly
// no. Guard preservado tal cual — ver nota de "one-render lag" en
// design.md.
export function LocalGamePage() {
  const { gameId, mode, game, exposeLocalGameBack, exposeLocalGameReset } = useOutletContext<AppOutletContext>();

  if (!(mode === "local" && game)) return null;

  return (
    <GameLoadErrorBoundary key={gameId}>
      <Suspense fallback={<GameLoading />}>
        <game.LocalGame onExposeBack={exposeLocalGameBack} onExposeReset={exposeLocalGameReset} />
      </Suspense>
    </GameLoadErrorBoundary>
  );
}
