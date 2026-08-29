import { AlertIcon } from "./icons";
import "./ErrorBanner.css";
import { DEFAULT_COLORS } from "../../theme/styles/colors";

/**
 * Un banner de error que se auto-limpia. El estado de error de quien lo usa
 * (ver `useMultiplayerSocket`) ya se auto-cronometra después de unos
 * segundos; el trabajo de este componente es solo hacer visible un fallo
 * *repetido* aunque el texto del mensaje sea idéntico al que ya está en
 * pantalla — `flashKey` se incrementa en cada (re-)disparo, y usarlo como
 * `key` del elemento fuerza un remount para que la animación de destello se
 * repita en vez de no hacer nada en silencio.
 */
export function ErrorBanner({ message, flashKey, variant = "block" }: { message: string; flashKey: number; variant?: "block" | "inline" }) {
  if (!message) return null;

  return (
    <div key={flashKey} className={`jt-error-banner jt-error-banner--${variant}`}>
      <span className="jt-error-banner-icon" aria-hidden>
        <AlertIcon size={variant === "block" ? 16 : 14} color={`var(--jt-danger-text, ${DEFAULT_COLORS.dangerText})`} />
      </span>
      <span className="jt-error-banner-text">{message}</span>
    </div>
  );
}
