import { S } from "../../../theme/styles";

// Brief pause shown between the last round's own result and the final
// standings reveal, so "Fin del juego" doesn't feel like an abrupt jump cut.
export function FinalResultsLoading() {
  return (
    <div style={{ ...S.cardHighlight, textAlign: "center", padding: "48px 20px" }}>
      <p style={{ fontSize: 15, color: "#9089c0", margin: 0 }}>Cargando resultados finales...</p>
    </div>
  );
}
