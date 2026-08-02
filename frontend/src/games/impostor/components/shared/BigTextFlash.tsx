interface BigTextFlashProps {
  eyebrow?: string;
  text: string;
}

// A brief, fully opaque full-screen flash — solid background (not a
// translucent modal) so nothing behind it bleeds through, and the group's
// attention lands squarely on this beat instead of a screen just cutting to
// the next one. Shared by every "big letters" transition moment across
// LocalGame (VoteResultsFlash, RoundStartFlash) and online's RoundView
// (replaces the numeric RevealCountdown for the result reveal) — same shell,
// each caller just supplies its own copy and owns its own mount duration.
export function BigTextFlash({ eyebrow, text }: BigTextFlashProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <style>{`
        .impostor-big-text-flash {
          text-align: center;
          animation: impostor-big-text-flash 1.4s ease-in-out both;
        }
        @keyframes impostor-big-text-flash {
          0% { opacity: 0; transform: scale(0.85); }
          20% { opacity: 1; transform: scale(1.06); }
          80% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.08); }
        }
      `}</style>
      <div className="impostor-big-text-flash">
        {eyebrow && (
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--jt-accent, #e0202b)",
            }}
          >
            {eyebrow}
          </p>
        )}
        <p
          style={{
            margin: 0,
            fontSize: "clamp(1.6rem, 8vw, 2.6rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#fff",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
