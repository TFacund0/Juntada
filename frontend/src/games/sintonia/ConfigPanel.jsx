import { S } from "../../theme/styles";

// Sintonía no tiene reglas para ajustar — cada ronda rota el psíquico
// automáticamente. Arrancá cuando estén al menos 3 jugadores.
export function ConfigPanel() {
  return (
    <div style={{ ...S.card, textAlign: "center" }}>
      <p style={{ ...S.muted, margin: 0 }}>Sin configuración — en cada ronda le toca a alguien distinto ser el psíquico. Arrancá cuando estén todos.</p>
    </div>
  );
}
