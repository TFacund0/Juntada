interface Category {
  id: string;
  label: string;
  icon?: string;
}

export function CategoryChip({
  cat,
  active,
  onToggle,
  onRemove,
}: {
  cat: Category;
  active: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderRadius: 999,
        border: active ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
        background: active ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
        boxShadow: active ? "0 3px 14px rgba(127,119,221,0.35)" : "none",
        transition: "all 0.15s",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: onRemove ? "10px 6px 10px 16px" : "10px 16px",
          border: "none",
          background: "none",
          color: active ? "#fff" : "#9089c0",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {cat.icon && <span>{cat.icon}</span>}
        <span>{cat.label}</span>
      </button>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Quitar ${cat.label}`}
          style={{
            border: "none",
            background: "none",
            color: active ? "rgba(255,255,255,0.7)" : "#6b6490",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            padding: "10px 14px 10px 4px",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
