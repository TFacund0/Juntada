import { useEffect } from "react";

const SHOW_MS = 1400;

/**
 * Pantalla breve mostrada entre terminar de escribir (¡BASTA!/"Ya terminé")
 * y arrancar a votar — puramente visual, mismo criterio que RoundIntro
 * (entre Setup y Writing): el servidor ya movió room.phase a "review" en
 * cuanto se dispara, esto solo retiene el swap a ReviewPhase un instante.
 * Diseño propio (no el mismo countdown 3-2-1 de RoundIntro) — una lupa que
 * "escanea" una barra, a tono con lo que viene: revisar las respuestas de
 * todos.
 */
export function ReviewIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, SHOW_MS);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div className="tf-intro-stage">
      <span className="tf-review-intro-icon" aria-hidden="true">
        🔍
      </span>
      <div className="tf-review-scan-wrap">
        <span className="tf-review-scan-beam" />
      </div>
      <p className="tf-intro-label">Revisando respuestas...</p>
    </div>
  );
}
