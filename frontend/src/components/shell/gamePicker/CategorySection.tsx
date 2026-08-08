import type { CSSProperties, ReactNode } from "react";
import { ChevronDownIcon } from "../../ui/icons";

interface CategorySectionProps {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

// Toggle de solo encabezado (sin envoltorio de card) para una sección del
// picker — distinto de components/Collapsible.tsx, que encierra información
// secundaria dentro de una S.card.
export function CategorySection({ title, count, open, onToggle, children }: CategorySectionProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <button onClick={onToggle} style={categoryHeaderStyle}>
        <span className="jt-cat-title">{title}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--jt-accent-strong, #afa9ec)",
            }}
          >
            {count} {count === 1 ? "juego" : "juegos"}
          </span>
          <span
            style={{
              color: "var(--jt-label, #7F77DD)",
              display: "flex",
              flexShrink: 0,
              transition: "transform 0.15s ease",
              transform: open ? "rotate(180deg)" : "none",
            }}
          >
            <ChevronDownIcon open={open} />
          </span>
        </span>
      </button>
      {open && children}
    </div>
  );
}

const categoryHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 12,
  width: "100%",
  background: "none",
  border: "none",
  padding: 0,
  marginBottom: 8,
  cursor: "pointer",
  fontFamily: "inherit",
};
