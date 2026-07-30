import type { CSSProperties } from "react";
import type { GameDef } from "../games/gameTypes";
import { isUnderMaintenance } from "../games/maintenance";
import { S } from "../theme/styles";
import { Btn } from "./Btn";
import { DialogFrame } from "./DialogFrame";

interface GameDetailDialogProps {
  game: GameDef;
  onStart: () => void;
  onClose: () => void;
}

/**
 * Se muestra al tocar la tarjeta de un juego en `GamePicker`, antes de
 * navegar de verdad a él — una parada de vista previa (título, arte,
 * descripción, botón de arrancar) para que elegir un juego no sea un
 * compromiso a ciegas de un solo toque una vez que el catálogo tiene
 * varios.
 */
export function GameDetailDialog({ game, onStart, onClose }: GameDetailDialogProps) {
  return (
    <DialogFrame onClose={onClose} maxWidth={380} padding={0} cardStyle={{ overflow: "hidden", position: "relative" }}>
      <button onClick={onClose} aria-label="Cerrar" style={closeButtonStyle}>
        ✕
      </button>

      <div style={{ ...S.catalogThumb, aspectRatio: "16 / 10", fontSize: 56, borderRadius: 0, overflow: "hidden" }}>
        {game.backgroundImage ? (
          <img src={game.backgroundImage} alt={game.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : game.logo ? (
          <img src={game.logo} alt={game.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          game.icon
        )}
      </div>

      <div style={{ padding: "20px" }}>
        <p style={{ fontWeight: 800, fontSize: 22, margin: "0 0 10px", letterSpacing: "-0.01em" }}>{game.label}</p>
        <p style={{ color: "#a49dc9", fontSize: 14, margin: "0 0 22px", lineHeight: 1.5 }}>{game.description}</p>
        {isUnderMaintenance(game) ? (
          <Btn disabled variant="ghost">
            En mantenimiento
          </Btn>
        ) : game.comingSoon ? (
          <Btn disabled variant="ghost">
            Más información próximamente
          </Btn>
        ) : (
          <Btn onClick={onStart}>Jugar</Btn>
        )}
      </div>
    </DialogFrame>
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
