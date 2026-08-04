/**
 * Texto de la pista de la palabra (letras reveladas, separadas por
 * espaciado ancho y en monospace) tal como aparece en el header del
 * tablero — compartido por quien adivina online (`DrawingPhaseScreen`, ve
 * `round.wordHint`) y por el modo local (`LocalDrawingScreen`, que la
 * calcula con su propio timer pero muestra el mismo texto, ya que la
 * pantalla es compartida por todos los jugadores).
 */
export function HintText({ hint }: { hint: string }) {
  return (
    <p style={{ fontSize: 17, fontWeight: 800, letterSpacing: "0.3em", margin: 0, fontFamily: "monospace", textAlign: "center" }}>{hint}</p>
  );
}
