import { useEffect, useState, type ReactNode } from "react";
import { S } from "../../../theme/styles";

/**
 * Card de letra — compartida por las 4 fases, con dos variantes:
 * - "sm": badge chico y compacto, usado dentro de Writing/Review donde la
 *   letra es solo un recordatorio junto al resto del contenido.
 * - "hero": pantalla central del sorteo/elección de letra (Setup, y el
 *   sorteo de LocalGame) — insignia circular grande con glow, flip 3D al
 *   cambiar de letra (con una breve pausa antes de girar, para que se
 *   sienta como una revelación) y una leve animación idle mientras se
 *   espera. Un solo componente en vez de dos separados porque ambos
 *   comparten toda la lógica de "animar solo cuando la letra realmente
 *   cambia" — solo cambia qué clases/tamaños aplica.
 */
export function LetterReveal({
  letter,
  label = "La letra es...",
  size = "sm",
  pending = false,
  footer,
}: {
  letter: string | null;
  label?: string;
  size?: "sm" | "hero";
  /**
   * Solo hero: mientras es `true`, la insignia gira sin mostrar ninguna
   * letra (ni la vieja ni la nueva) — factor sorpresa real, en vez de que
   * la letra nueva ya se vea de entrada mientras la insignia todavía está
   * terminando de girar. El que llama (SetupPhase) decide cuánto dura esto
   * (mínimo + esperar a que la letra realmente cambie en el servidor).
   */
  pending?: boolean;
  footer?: ReactNode;
}) {
  const hero = size === "hero";
  // El modo hero espera un instante antes de animar, para que el cambio se
  // sienta como una revelación (suspenso breve) en vez de un reemplazo
  // instantáneo de texto — el modo compacto no lo necesita, ahí la letra es
  // solo un recordatorio secundario.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    if (letter == null || pending) return;
    const delay = hero ? 150 : 0;
    const showId = setTimeout(() => setAnimate(true), delay);
    const hideId = setTimeout(() => setAnimate(false), delay + 550);
    return () => {
      clearTimeout(showId);
      clearTimeout(hideId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter, pending]);

  return (
    <div
      // El modo hero no lleva la card rectangular (S.cardHighlight) — es la
      // insignia circular sola, flotando sobre el fondo, sin ningún bloque
      // encuadrándola. El glow radial de fondo (tf-letter-card--hero::before)
      // se mantiene, pero ya no recortado por los bordes de una card.
      style={
        hero
          ? { textAlign: "center", position: "relative" }
          : { ...S.cardHighlight, textAlign: "center", padding: "18px 20px", position: "relative", overflow: "hidden" }
      }
      className={hero ? "tf-letter-card--hero" : "tf-letter-card"}
    >
      <p style={{ fontSize: hero ? 13 : 12, color: "var(--jt-muted-text, #9089c0)", marginBottom: hero ? 14 : 4 }}>{label}</p>
      {pending ? (
        <p className="tf-letter-badge tf-letter-spin" style={{ margin: "0 auto", fontWeight: 800, color: "#fff" }}>
          🍀
        </p>
      ) : (
        <p
          key={letter}
          className={[hero ? "tf-letter-badge" : "", animate ? (hero ? "tf-letter-flip" : "tf-letter-pop") : hero ? "tf-letter-float" : ""]
            .filter(Boolean)
            .join(" ")}
          style={
            hero
              ? { margin: "0 auto", fontWeight: 800, color: "#fff" }
              : { fontSize: 32, fontWeight: 800, color: "var(--jt-accent-strong, #AFA9EC)", margin: 0, lineHeight: 1 }
          }
        >
          {letter || "?"}
        </p>
      )}
      {footer}
    </div>
  );
}
