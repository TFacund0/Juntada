import { S } from "../../theme/styles";

// DESIGN.md sección 7 / PLAN.md: no se implementa modo local por ahora — la
// fase Planificación oculta (Túnel) es bastante más compleja de resolver en
// un solo dispositivo compartido, y se prioriza que el modo online funcione
// completo primero. Se reevalúa más adelante.
export function LocalGame() {
  return (
    <div style={{ ...S.card, textAlign: "center" }}>
      <p style={{ margin: 0 }}>Riel Salvaje todavía no tiene modo local — se juega solo online, entre 3 y 6 jugadores.</p>
    </div>
  );
}
