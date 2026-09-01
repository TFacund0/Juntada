import clsx from "clsx";
import { T } from "../../../theme/styles/classes";

/**
 * Cartel de fase "reveal" mostrando la palabra que se estaba dibujando.
 *
 * Compartido entre el modo local y el modo online — misma tarjeta,
 * independiente de cómo cada modo llega a conocer la palabra.
 *
 * @param word La palabra que se dibujó en el turno.
 */
export function RevealedWordCard({ word }: { word: string }) {
  return (
    <div className={clsx(T.cardHighlight, "text-center")}>
      <p className="text-[13px] text-[#9089c0]">La palabra era</p>
      <p className={T.bigReveal}>{word}</p>
    </div>
  );
}
