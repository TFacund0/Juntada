import { S } from "../../theme/styles";

interface ComingSoonProps {
  label?: string;
}

/**
 * Placeholder compartido para cualquier juego que ya está registrado (así
 * aparece en el picker) pero todavía no está implementado. Ver
 * `games/registry.ts`.
 */
export function ComingSoon({ label = "Este juego" }: ComingSoonProps) {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center" }}>
      <p style={{ fontWeight: 800, fontSize: 18, margin: "0 0 6px" }}>{label} está en construcción</p>
      <p style={{ color: "#9089c0", fontSize: 13, margin: 0 }}>Todavía no se puede jugar, pero ya aparece en el menú.</p>
    </div>
  );
}
