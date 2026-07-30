import type { ReactNode } from "react";
import { Avatar } from "../../../components/Avatar";

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
// moment a vote resolves.
export function EliminationRevealOverlay({
  name,
  wasImpostor,
  onContinue,
}: {
  name: string;
  wasImpostor: boolean | undefined;
  onContinue: () => void;
}) {
  const roleColor = wasImpostor ? "#F09595" : "#5DCAA5";
  return (
    <RevealModal borderColor={`${wasImpostor == null ? "rgba(224,32,43,0.35)" : roleColor}66`} onContinue={onContinue}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Avatar name={name} size={52} />
        <p style={{ fontWeight: 800, fontSize: 19, margin: "12px 0 2px" }}>{name}</p>
        <p style={{ color: "var(--jt-muted-text)", fontSize: 13, margin: "0 0 12px" }}>quedó eliminado/a</p>
      </div>
      {wasImpostor != null && (
        <span
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.02em",
            color: roleColor,
            background: wasImpostor ? "rgba(240,149,149,0.15)" : "rgba(93,202,165,0.15)",
            border: `1px solid ${wasImpostor ? "rgba(240,149,149,0.4)" : "rgba(93,202,165,0.4)"}`,
          }}
        >
          {wasImpostor ? "ERA EL IMPOSTOR" : "ERA INOCENTE"}
        </span>
      )}
    </RevealModal>
  );
}

// Step 2 (only once the match itself is over): who won, the rest of the
// impostors if there was more than one, and the secret word — shown right
// after the elimination reveal above is dismissed.
export function MatchOutcomeOverlay({
  winner,
  impostorNames,
  word,
  onContinue,
}: {
  winner: "innocents" | "impostors" | null;
  impostorNames: string[];
  word: string;
  onContinue: () => void;
}) {
  const winnerColor = winner === "innocents" ? "#5DCAA5" : "#F09595";
  const icon = winner === "innocents" ? "🛡️" : "🕵️";
  return (
    <RevealModal borderColor={`${winnerColor}88`} onContinue={onContinue}>
      <div
        style={{
          width: 72,
          height: 72,
          margin: "0 auto 14px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          background: `radial-gradient(circle, ${winnerColor}33, transparent 70%)`,
          border: `2px solid ${winnerColor}`,
          boxShadow: `0 0 24px -4px ${winnerColor}`,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          display: "inline-block",
          padding: "8px 18px",
          borderRadius: 999,
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.02em",
          color: winnerColor,
          background: `${winnerColor}26`,
          border: `1px solid ${winnerColor}66`,
          marginBottom: 20,
        }}
      >
        {winner === "innocents" ? "GANARON LOS INOCENTES" : impostorNames.length === 1 ? "GANÓ EL IMPOSTOR" : "GANARON LOS IMPOSTORES"}
      </span>
      {impostorNames.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "var(--jt-muted-text)", margin: "0 0 4px" }}>
            {impostorNames.length === 1 ? "El impostor era" : "Los impostores eran"}
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{impostorNames.join(", ")}</p>
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--jt-muted-text)", margin: "0 0 4px" }}>La palabra era</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: "#F2F0EA", margin: 0 }}>{word}</p>
    </RevealModal>
  );
}
