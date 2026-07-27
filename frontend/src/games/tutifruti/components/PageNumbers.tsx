// Numbered page picker (1, 2, 3, ...) instead of just prev/next arrows, so
// jumping straight to a page you already know is one tap instead of several.
// Shared verbatim by LocalGame and ConfigPanel — both page the same long
// DEFAULT_CATEGORIES list.
export function PageNumbers({
  pageCount,
  currentPage,
  onChange,
}: {
  pageCount: number;
  currentPage: number;
  onChange: (page: number) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
      {Array.from({ length: pageCount }, (_, i) => i).map(i => (
        <button
          key={i}
          onClick={() => onChange(i)}
          style={{
            minWidth: 34,
            height: 34,
            padding: "0 4px",
            borderRadius: 8,
            border: i === currentPage ? "1px solid rgba(127,119,221,0.6)" : "1px solid rgba(255,255,255,0.12)",
            background: i === currentPage ? "linear-gradient(135deg,#7F77DD,#534AB7)" : "rgba(255,255,255,0.04)",
            color: i === currentPage ? "#fff" : "#9089c0",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}
