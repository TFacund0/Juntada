import type { ReactNode } from "react";

// A divider between rule questions that live inside the same T.card — used
// by both LocalGame and ConfigPanel's "Reglas" tab so it reads as one
// cohesive block instead of separate cards per question. The first section
// in a card should render without a divider.
export function ConfigSection({ divider = true, children }: { divider?: boolean; children: ReactNode }) {
  return <div className={divider ? "mt-[18px] border-t border-white/[0.08] pt-[18px]" : undefined}>{children}</div>;
}
