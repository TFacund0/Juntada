export function Avatar({ name, size = 40 }) {
  const initials = name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  const colors = ["#534AB7", "#0F6E56", "#993C1D", "#185FA5", "#854F0B", "#993556", "#3B6D11", "#A32D2D"];
  const bg = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {initials}
    </div>
  );
}
