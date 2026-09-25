import { useEffect, useRef, type ReactNode } from "react";

// The end of the duel (the reference's #endScreen): a dim overlay with one
// panel — who won, a line about it, and whatever buttons the mode needs
// (local: play again; online: back to the room).
export function EndScreen({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  // Like the reference, focus lands on the first action.
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector("button")?.focus();
  }, []);
  return (
    <div className="rec-overlay winner-overlay">
      <div ref={panel} className="end-panel" role="dialog" aria-modal="true" aria-label={title}>
        <h1 className="end-title display">{title}</h1>
        <p className="end-sub">{sub}</p>
        {children}
      </div>
    </div>
  );
}
