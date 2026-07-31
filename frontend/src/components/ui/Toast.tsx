import { useEffect, useState } from "react";

const EXIT_MS = 200;

/**
 * Un banner breve que se auto-cierra (ej. "X se desconectó") — el padre es
 * dueño del estado del mensaje, pero este componente retiene el último
 * mensaje un instante más para poder reproducir su propia salida (en vez de
 * desaparecer de golpe en el mismo tick en que el padre limpia el estado) y
 * recién ahí llama a `onExpire`. No renderiza nada cuando no hay nada que
 * mostrar, así quien lo usa puede montarlo incondicionalmente.
 */
export function Toast({ message, duration = 3000, onExpire }: { message: string | null; duration?: number; onExpire: () => void }) {
  const [shown, setShown] = useState(message);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (!message) return;
    setShown(message);
    setPhase("in");
    const t = setTimeout(() => setPhase("out"), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  useEffect(() => {
    if (phase !== "out" || !shown) return;
    const t = setTimeout(onExpire, EXIT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, shown]);

  if (!shown) return null;

  return (
    <>
      {/* Entra cayendo desde arriba y sale con un fade corto en vez de
          aparecer/desaparecer de golpe, para que se sienta como la llegada
          (y despedida) de una notificación real. */}
      <style>{`
        @keyframes toast-drop-in {
          from { opacity: 0; transform: translate(-50%, -16px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes toast-fade-out {
          from { opacity: 1; transform: translate(-50%, 0); }
          to { opacity: 0; transform: translate(-50%, -10px); }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          zIndex: 2000,
          background: "var(--jt-surface, #171329)",
          border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.35))",
          borderRadius: 10,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 600,
          color: "#e8e4f0",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          maxWidth: "calc(100vw - 32px)",
          textAlign: "center",
          animation: phase === "out" ? `toast-fade-out ${EXIT_MS}ms ease-in forwards` : "toast-drop-in 0.25s ease-out forwards",
        }}
      >
        {shown}
      </div>
    </>
  );
}
