import { useEffect } from "react";

// A brief, self-dismissing banner (e.g. "X se desconectó") — the parent owns
// the message state and just stops rendering this after `onExpire` fires;
// this component only owns the timer. Renders nothing when there's no
// message, so callers can mount it unconditionally.
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
      {/* Drops in from above instead of just popping into place, so it
          reads as a notification arriving rather than a static label that
          happened to appear. */}
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
          background: "#171329",
          border: "1px solid rgba(127,119,221,0.35)",
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
