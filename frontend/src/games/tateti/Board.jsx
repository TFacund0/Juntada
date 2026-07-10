const MARK_COLOR = { X: "#AFA9EC", O: "#5DCAA5" };

export function Board({ board, winningLine, onCellClick, disabled }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 300, margin: "0 auto" }}>
      {board.map((cell, i) => {
        const isWinning = winningLine?.includes(i);
        const clickable = !disabled && !cell && typeof onCellClick === "function";
        return (
          <button
            key={i}
            onClick={() => clickable && onCellClick(i)}
            disabled={!clickable}
            style={{
              aspectRatio: "1/1", borderRadius: 14, fontSize: 40, fontWeight: 800, fontFamily: "inherit",
              cursor: clickable ? "pointer" : "default",
              background: isWinning ? "rgba(93,202,165,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${isWinning ? "rgba(93,202,165,0.5)" : "rgba(127,119,221,0.25)"}`,
              color: cell ? MARK_COLOR[cell] : "transparent",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            {cell || "·"}
          </button>
        );
      })}
    </div>
  );
}
