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

  const style =
    variant === "block"
      ? {
          background: "rgba(226,75,74,0.1)",
          border: "1px solid rgba(226,75,74,0.3)",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 16,
          color: "#F09595",
          fontSize: 13,
          textAlign: "center" as const,
        }
      : {
          color: "#F09595",
          fontSize: 13,
          textAlign: "center" as const,
          marginTop: 10,
        };

  return (
    <>
      <style>{`
        @keyframes error-flash {
          0% { opacity: 0; transform: scale(0.96); }
          12% { opacity: 1; transform: scale(1.015); }
          25% { transform: scale(1); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div key={flashKey} style={{ ...style, animation: "error-flash 0.4s ease-out" }}>
        {message}
      </div>
    </>
  );
}
