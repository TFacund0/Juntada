import { S } from "../theme/styles";

// Shared placeholder for any game that's registered (so it shows in the
// picker) but not implemented yet. See games/registry.js.
export function ComingSoon({ label = "Este juego" }) {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center" }}>
      <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>{label} está en construcción</p>
      <p style={{ color: "#9089c0", fontSize: 13, margin: 0 }}>Todavía no se puede jugar, pero ya aparece en el menú.</p>
    </div>
  );
}
