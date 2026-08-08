import { S } from "../../../theme/styles";

// Ta-Te-Ti has no rules to tweak — this just fills the contract's slot in the
// multiplayer lobby with a short note instead of an empty gap.
export function ConfigPanel() {
  return (
    <div style={{ ...S.card, textAlign: "center" }}>
      <p style={{ ...S.muted, margin: 0 }}>Sin configuración — el clásico 3 en raya. Arrancá cuando estén los dos.</p>
    </div>
  );
}
