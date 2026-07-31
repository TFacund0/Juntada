import type { ReactNode } from "react";
import { Avatar } from "../../../../components/ui/Avatar";
import logo from "../../assets/logo.png";

const overlayAnimations = `
  @keyframes reveal-overlay-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes reveal-overlay-pop {
    0% { opacity: 0; transform: scale(0.85) translateY(6px); }
    60% { opacity: 1; transform: scale(1.03) translateY(0); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .impostor-reveal-continue {
    transition: transform 0.1s ease-out, box-shadow 0.2s ease-out, filter 0.2s ease-out;
  }
  .impostor-reveal-continue:hover {
    transform: scale(1.02);
    filter: brightness(1.1);
    box-shadow: 0 6px 24px rgba(224,32,43,0.5);
  }
  .impostor-reveal-continue:active {
    transform: scale(0.96);
  }
`;

// Shared centered-modal shell for both reveal steps below — same idea as
// Recámara's OutcomeBanner: pacing is entirely in the group's hands (tap
// "Continuar" whenever they're done reacting), not an inline card that's
// already visible before anyone's braced for it.
function RevealModal({ borderColor, onContinue, children }: { borderColor: string; onContinue: () => void; children: ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,8,20,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
        animation: "reveal-overlay-fade 0.2s ease-out",
      }}
    >
      <style>{overlayAnimations}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--jt-surface, #171329)",
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          padding: "28px 20px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          animation: "reveal-overlay-pop 0.4s ease-out",
        }}
      >
        {children}
        <button
          className="impostor-reveal-continue"
          onClick={onContinue}
          style={{
            marginTop: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            boxSizing: "border-box",
            padding: "12px 24px",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            border: "none",
            fontFamily: "inherit",
            background: "linear-gradient(135deg,#E0202B,#7A1A20)",
            color: "#fff",
            boxShadow: "0 4px 20px rgba(224,32,43,0.35)",
          }}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// Step 1: who got eliminated and (once revealed) their role — shown the
// moment a vote resolves. The avatar sits inside a role-colored ring instead
// of a plain circle, and the card's own tint leans toward that role color,
// so the verdict reads at a glance before anyone even gets to the text.
export function EliminationRevealOverlay({
  name,
  wasImpostor,
  onContinue,
}: {
  name: string;
  wasImpostor: boolean | undefined;
  onContinue: () => void;
}) {
  const roleColor = wasImpostor == null ? "#7F77DD" : wasImpostor ? "#F09595" : "#5DCAA5";
  return (
    <RevealModal borderColor={`${roleColor}66`} onContinue={onContinue}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            padding: 4,
            borderRadius: "50%",
            border: `2px solid ${roleColor}`,
            boxShadow: `0 0 20px -2px ${roleColor}`,
            marginBottom: 14,
          }}
        >
          <Avatar name={name} size={56} />
        </div>
        <p style={{ fontWeight: 800, fontSize: 20, margin: "0 0 4px" }}>{name}</p>
        <p style={{ color: "var(--jt-muted-text)", fontSize: 13, margin: "0 0 14px" }}>quedó eliminado/a</p>
      </div>
      {wasImpostor != null && (
        <span
          style={{
            display: "inline-block",
            padding: "8px 18px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: roleColor,
            background: `${roleColor}22`,
            border: `1px solid ${roleColor}66`,
          }}
        >
          {wasImpostor ? "ERA EL IMPOSTOR" : "ERA INOCENTE"}
        </span>
      )}
    </RevealModal>
  );
}

// Step 2 (only once the match itself is over): who won and the rest of the
// impostors if there was more than one — shown right after the elimination
// reveal above is dismissed. `word` is optional: LocalGame's ResultScreen
// already shows it further down its own result page, so it skips passing
// this; online's ResultPhaseScreen has nowhere else to show it, so it still
// does. An impostor win uses the game's own logo instead of a stand-in
// emoji — there's no real "impostor" artwork, but the logo reads fine as
// the game's own mark rather than a literal face.
export function MatchOutcomeOverlay({
  winner,
  impostorNames,
  word,
  onContinue,
}: {
  winner: "innocents" | "impostors" | null;
  impostorNames: string[];
  word?: string;
  onContinue: () => void;
}) {
  const winnerColor = winner === "innocents" ? "#5DCAA5" : "#F09595";
  return (
    <RevealModal borderColor={`${winnerColor}88`} onContinue={onContinue}>
      <div
        style={{
          width: 68,
          height: 68,
          margin: "0 auto 14px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 32,
          background: `radial-gradient(circle, ${winnerColor}33, transparent 70%)`,
          border: `2px solid ${winnerColor}`,
          boxShadow: `0 0 24px -4px ${winnerColor}`,
          overflow: "hidden",
        }}
      >
        {winner === "innocents" ? "🏆" : <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
      </div>
      <p
        style={{
          margin: "0 0 6px",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--jt-muted-text)",
        }}
      >
        Partida terminada
      </p>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          color: winnerColor,
          textShadow: `0 0 24px ${winnerColor}55`,
        }}
      >
        {winner === "innocents" ? "Ganaron los inocentes" : impostorNames.length === 1 ? "Ganó el impostor" : "Ganaron los impostores"}
      </p>
      {impostorNames.length > 0 && (
        <div style={{ marginBottom: word ? 16 : 0 }}>
          <p style={{ fontSize: 11, color: "var(--jt-muted-text)", margin: "0 0 4px" }}>
            {impostorNames.length === 1 ? "El impostor era" : "Los impostores eran"}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{impostorNames.join(", ")}</p>
        </div>
      )}
      {word && (
        <>
          <p style={{ fontSize: 11, color: "var(--jt-muted-text)", margin: "0 0 4px" }}>La palabra era</p>
          <p style={{ fontSize: 17, fontWeight: 800, color: "#F2F0EA", margin: 0 }}>{word}</p>
        </>
      )}
    </RevealModal>
  );
}
