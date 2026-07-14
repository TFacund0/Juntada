import type { ReactNode } from "react";

// A single primary action (start the round/match) pinned to the bottom of
// the screen with a fade so it never gets lost below a long scrollable
// lobby/config — same treatment in the online lobby (MultiplayerGame.tsx)
// and local pass-and-play setup (LocalGame.tsx). The page content needs its
// own bottom padding (~88px) to keep this from covering the last card.
export function StickyActionBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
        background: "linear-gradient(rgba(15,12,29,0), #0f0c1d 24%)",
        zIndex: 10,
      }}
    >
      <div style={{ maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
