import { useCountdownSeconds } from "../../../../components/game-kit/hooks/useCountdownSeconds";
import { autoPickLabel } from "../../utils/turnText";
import { WordCardFan } from "./WordCardFan";

interface ChooseWordPanelProps {
  words: readonly string[];
  onChoose: (word: string) => void;
  /** Cuándo el servidor elige solo (online); sin esto no hay cuenta regresiva (el modo local no elige solo). */
  autoPickAt?: number | null;
  autoPickTotal?: number;
}

function AutoPickCountdown({ at, total }: { at: number; total?: number }) {
  const { secs } = useCountdownSeconds(at, total);
  return <p className="mt-[18px] text-[13px] text-rl-muted">{autoPickLabel(secs)}</p>;
}

/**
 * Pantalla de quien elige palabra (`#sChoose` de la referencia): "Te toca
 * dibujar", la aclaración, el abanico de cartas y "Se elige sola en Ns" —
 * compartida por el modo online (`ChoosingPhaseScreen`) y el local
 * (`WordRevealScreen`).
 */
export function ChooseWordPanel({ words, onChoose, autoPickAt, autoPickTotal }: ChooseWordPanelProps) {
  return (
    // El abanico es más ancho que un celular chico (como en la referencia): se recorta en vez de scrollear la página.
    <div className="w-full overflow-x-clip font-figtree text-rl-ink">
      <div className="mx-auto flex min-h-[min(60vh,480px)] w-full max-w-[480px] flex-col items-center justify-center text-center">
        <h2 className="mb-1 mt-0 font-marker text-[30px] font-normal">Te toca dibujar</h2>
        <p className="mb-[34px] mt-0 text-rl-muted">Elegí una palabra. Los demás no la ven.</p>
        <WordCardFan words={words} onChoose={onChoose} />
        {autoPickAt != null && <AutoPickCountdown at={autoPickAt} total={autoPickTotal} />}
      </div>
    </div>
  );
}
