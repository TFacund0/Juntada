import type { CSSProperties } from "react";
import type { GameDef } from "../games/gameTypes";
import { S } from "../theme/styles";
import { Btn } from "./Btn";

interface GameDetailDialogProps {
  game: GameDef;
  onStart: () => void;
  onClose: () => void;
}

// Shown after tapping a game card in GamePicker, before actually navigating
// into it — a preview stop (title, art, description, start) so picking a
// game isn't a blind one-tap commitment once the catalog has many of them.
export function GameDetailDialog({ game, onStart, onClose }: GameDetailDialogProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,12,29,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#171329",
          border: "1px solid rgba(127,119,221,0.3)",
          borderRadius: 16,
          maxWidth: 380,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <button onClick={onClose} aria-label="Cerrar" style={closeButtonStyle}>
          ✕
        </button>

        <div style={{ ...S.catalogThumb, aspectRatio: "16 / 10", fontSize: 56, borderRadius: 0 }}>{game.icon}</div>

        <div style={{ padding: "20px" }}>
          <p style={{ fontWeight: 800, fontSize: 22, margin: "0 0 10px", letterSpacing: "-0.01em" }}>{game.label}</p>
          <p style={{ color: "#a49dc9", fontSize: 14, margin: "0 0 22px", lineHeight: 1.5 }}>{game.description}</p>
          <Btn onClick={onStart}>{game.comingSoon ? "Ver más" : "Jugar"}</Btn>
        </div>
      </div>
    </div>
  );
}

const closeButtonStyle: CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  width: 30,
  height: 30,
  borderRadius: "50%",
  background: "rgba(0,0,0,0.45)",
  border: "none",
  color: "#e8e4f0",
  fontSize: 14,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1,
};
