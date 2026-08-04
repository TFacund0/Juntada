import { useEffect, useState } from "react";
import type { TutifrutiRoundState } from "../types";

const COUNT_STEPS = [3, 2, 1] as const;
const STEP_MS = 650;

/**
 * Pantalla de cuenta regresiva mostrada un instante entre confirmar la
 * letra (Setup) y arrancar a escribir — puramente client-side y decorativa
 * (el servidor ya avanzó `room.phase` a "writing" en el momento en que se
 * confirma; ver RoundView.tsx, que retiene el cambio a `WritingPhase` hasta
 * que esta cuenta regresiva llama a `onDone`). Le da a la revelación de la
 * letra un momento propio en vez de saltar directo a la pantalla de
 * escritura.
 */
export function RoundIntro({ round, onDone }: { round: TutifrutiRoundState; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const finished = step >= COUNT_STEPS.length;

  useEffect(() => {
    const id = setTimeout(() => (finished ? onDone() : setStep(s => s + 1)), STEP_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <div className="tf-intro-stage">
      <p className="tf-intro-label">Letra "{round.letter}"</p>
      <p key={step} className={finished ? "tf-intro-num tf-intro-go" : "tf-intro-num tf-intro-tick"}>
        {finished ? "¡Ya!" : COUNT_STEPS[step]}
      </p>
    </div>
  );
}
