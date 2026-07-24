import { useState } from "react";
import type { ReactNode } from "react";
import { S } from "../theme/styles";

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// A S.card that starts collapsed to its title bar — used for secondary info
// (round points, scoreboards) that would otherwise clutter the screen once
// there are several players.
export function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.card}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "inherit",
          marginBottom: open ? 10 : 0,
        }}
      >
        <span style={{ ...S.label, marginBottom: 0 }}>{title}</span>
        <span style={{ color: "#7F77DD", fontSize: 12, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          ▼
        </span>
      </button>
      {open && children}
    </div>
  );
}
