import { useEffect } from "react";

/**
 * Un banner breve que se auto-cierra (ej. "X se desconectó") — el padre es
 * dueño del estado del mensaje y simplemente deja de renderizar esto cuando
 * dispara `onExpire`; este componente solo administra el timer. No
 * renderiza nada cuando no hay mensaje, así quien lo usa puede montarlo
 * incondicionalmente.
 */
export function Toast({ message, duration = 3000, onExpire }: { message: string | null; duration?: number; onExpire: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onExpire, duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, duration]);

  if (!message) return null;

  return (
    <>
      {/* Entra cayendo desde arriba en vez de aparecer de golpe, para que se
          sienta como la llegada de una notificación y no como una etiqueta
          estática que de repente apareció. */}
      <style>{`
        @keyframes toast-drop-in {
          from { opacity: 0; transform: translate(-50%, -16px); }
          to { opacity: 1; transform: translate(-50%, 0); }
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
          animation: "toast-drop-in 0.25s ease-out forwards",
        }}
      >
        {message}
      </div>
    </>
  );
}
