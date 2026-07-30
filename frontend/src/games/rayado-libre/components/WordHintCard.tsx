import { S } from "../../../theme/styles";

/**
 * Cartel con la pista progresiva de la palabra (letras reveladas con el paso
 * del tiempo, ver `computeWordHint` en `@juntada/rayado-libre-scoring`).
 *
 * Compartido entre el modo local (calcula la pista con su propio timer) y el
 * modo online (recibe `wordHint` ya calculado del servidor) — el cálculo
 * difiere, la presentación es idéntica.
 *
 * @param hint Pista ya calculada, lista para mostrar.
 */
export function WordHintCard({ hint }: { hint: string }) {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center" }}>
      <p style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.35em", margin: 0, fontFamily: "monospace" }}>{hint}</p>
    </div>
  );
}
