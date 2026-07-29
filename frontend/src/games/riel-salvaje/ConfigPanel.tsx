import { S } from "../../theme/styles";

// Sin ajustes propios todavía — mínimo/máximo de jugadores ya se valida
// server-side (backend/src/games/riel-salvaje/engine.ts), y el personaje de
// cada jugador se sortea al azar al arrancar la ronda (no hay pantalla de
// selección de personaje en esta fase, ver PLAN.md Fase 3).
export function ConfigPanel() {
  return (
    <div style={{ ...S.card, textAlign: "center" }}>
      <p style={{ ...S.muted, margin: 0 }}>
        Sin configuración todavía — se necesitan entre 3 y 6 jugadores. El personaje de cada uno se sortea al arrancar.
      </p>
    </div>
  );
}
