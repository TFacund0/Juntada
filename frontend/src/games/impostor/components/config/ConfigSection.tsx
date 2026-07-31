import type { ReactNode } from "react";

// A divider between rule questions that live inside the same S.card — used
// by both LocalGame and ConfigPanel's "Reglas" tab so it reads as one
// cohesive block instead of separate cards per question. The first section
// in a card should render without a divider.
export function ConfigSection({ divider = true, children }: { divider?: boolean; children: ReactNode }) {
  return (
    <div style={divider ? { paddingTop: 18, marginTop: 18, borderTop: "1px solid rgba(255,255,255,0.08)" } : undefined}>{children}</div>
  );
}
