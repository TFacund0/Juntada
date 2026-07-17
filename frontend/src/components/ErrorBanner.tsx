// A self-clearing error banner. The caller's error state (see
// useMultiplayerSocket) already times itself out after a few seconds; this
// component's job is just to make a *repeated* failure visible even when the
// message text is identical to what's already on screen — `flashKey` is
// bumped on every (re-)raise, and keying the element off it forces a remount
// so the flash animation replays instead of silently doing nothing.
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
