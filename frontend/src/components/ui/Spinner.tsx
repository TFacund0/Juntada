/**
 * Anillo giratorio genérico (ver .jt-spinner, theme/sharedChrome.css) para
 * cualquier estado de carga fuera de SessionRecoveryOverlay (que tiene el
 * suyo propio, con su propia paleta de estados) — ej. el fallback de
 * `Suspense` al cargar el bundle de un juego (GameLoading en App.tsx).
 */
export function Spinner({ size = 32 }: { size?: number }) {
  return <div className="jt-spinner" style={{ width: size, height: size }} />;
}
