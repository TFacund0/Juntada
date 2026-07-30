import { S } from "../../../theme/styles";

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
    <div style={{ ...S.cardHighlight, textAlign: "center" }}>
      <p style={{ fontSize: 13, color: "#9089c0" }}>La palabra era</p>
      <p style={S.bigReveal}>{word}</p>
    </div>
  );
}
