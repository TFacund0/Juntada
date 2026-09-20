import { useState } from "react";
import { createPortal } from "react-dom";
import { PhaseTransition } from "../../../components/game-kit/PhaseTransition";
import { Spinner } from "../../../components/ui/Spinner";
import type { RoundViewProps } from "../../gameTypes";
import type { TutifrutiRoundState } from "../types/roundView";
import { RoundResult } from "./RoundResult";
import { FinalStandings } from "./FinalStandings";

// Mismo fundido a negro que se usa al entrar/salir de un juego con tema
// propio (ver useCurtainTransition.ts) — reutiliza esas clases (.app-curtain,
// curtain.css, ya global) en vez de duplicar la animación. A diferencia de
// ese caso, acá se sostiene un instante en negro (CURTAIN_HOLD_MS) con un
// mensaje de carga, en vez de tapar y destapar de una — "Fin del juego" es
// el remate de toda la partida, se gana su propio momento antes de revelar
// los standings, no un corte instantáneo.
const CURTAIN_IN_MS = 260;
const CURTAIN_HOLD_MS = 550;
const CURTAIN_OUT_MS = 380;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function ResultPhase({ room, isHost, send }: Pick<RoundViewProps, "room" | "isHost" | "send">) {
  const round = room.round as TutifrutiRoundState;
  const [showFinal, setShowFinal] = useState(false);
  const [curtain, setCurtain] = useState<"none" | "in" | "out">("none");

  const revealFinal = () => {
    if (prefersReducedMotion()) {
      setShowFinal(true);
      return;
    }
    setCurtain("in");
    setTimeout(() => {
      setShowFinal(true);
      setTimeout(() => {
        setCurtain("out");
        setTimeout(() => setCurtain("none"), CURTAIN_OUT_MS);
      }, CURTAIN_HOLD_MS);
    }, CURTAIN_IN_MS);
  };

  return (
    <>
      {/* Portal a document.body — igual motivo que StickyActionBar: un
          `position: fixed` acá adentro quedaría atrapado por el `transform`
          que PhaseTransition anima en su wrapper mientras la pantalla
          recién montada todavía se está animando. */}
      {curtain !== "none" &&
        createPortal(
          <div className={`app-curtain ${curtain}`}>
            <div className="tf-curtain-loading">
              <Spinner size={36} />
              <p>Cargando resultados finales...</p>
            </div>
          </div>,
          document.body,
        )}
      {round.isFinalRound && showFinal ? (
        <PhaseTransition phaseKey="final">
          <FinalStandings room={room} round={round} isHost={isHost} send={send} />
        </PhaseTransition>
      ) : (
        <PhaseTransition phaseKey={`round-${round.roundNumber}`}>
          <RoundResult room={room} round={round} isHost={isHost} onShowFinal={revealFinal} send={send} />
        </PhaseTransition>
      )}
    </>
  );
}
