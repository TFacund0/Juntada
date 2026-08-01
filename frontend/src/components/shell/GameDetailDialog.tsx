import { useState } from "react";
import type { CSSProperties } from "react";
import type { GameDef } from "../../games/gameTypes";
import { isUnderMaintenance } from "../../games/maintenance";
import { PICKER_META } from "../../games/pickerMeta";
import { Btn } from "../ui/Btn";
import { CloseIcon } from "../ui/icons";
import { DialogFrame } from "../dialogs/DialogFrame";
import { GameRules } from "./GameRules";
import "./GameDetailDialog.css";

interface GameDetailDialogProps {
  game: GameDef;
  onStart: () => void;
  onClose: () => void;
}

const CATEGORY_LABEL: Record<string, string> = {
  destacados: "Destacado",
  rapidos: "Juego rápido",
  palabras: "Palabras e ingenio",
  fiesta: "Para la previa",
  equipos: "Por equipos",
  tematicos: "Con su propia temática",
  otros: "Más juegos",
};

function HelpIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Se muestra al tocar la tarjeta de un juego en `GamePicker`, antes de
 * navegar de verdad a él — una parada de vista previa (título, arte,
 * descripción, botón de arrancar) para que elegir un juego no sea un
 * compromiso a ciegas de un solo toque una vez que el catálogo tiene varios.
 * El botón "¿Cómo se juega?" (mismo ícono/circulito que el navbar de la
 * partida en curso, ver AppHeader.tsx) abre las reglas ahí mismo, sin
 * primero tener que arrancar el juego para verlas.
 */
export function GameDetailDialog({ game, onStart, onClose }: GameDetailDialogProps) {
  const [showRules, setShowRules] = useState(false);
  const meta = PICKER_META[game.id];
  const hasRules = (game.rules?.length ?? 0) > 0;
  const blocked = isUnderMaintenance(game) || game.comingSoon;

  return (
    <>
      <DialogFrame
        onClose={onClose}
        maxWidth={400}
        padding={0}
        cardStyle={{ overflow: "hidden", position: "relative", borderRadius: 24 }}
        cardClassName="jt-detail-card"
      >
        <div className="jt-detail-thumb" style={{ opacity: blocked ? 0.6 : 1 }}>
          {game.backgroundImage ? (
            <img src={game.backgroundImage} alt={game.label} style={imgStyle} />
          ) : game.logo ? (
            <img src={game.logo} alt={game.label} style={imgStyle} />
          ) : (
            <span style={{ fontSize: 56 }}>{game.icon}</span>
          )}
          <div className="jt-detail-thumb-fade" />

          <button onClick={onClose} aria-label="Cerrar" className="jt-detail-icon-btn" style={{ top: 12, left: 12 }}>
            <CloseIcon size={16} />
          </button>
          {hasRules && (
            <button
              onClick={() => setShowRules(true)}
              aria-label="¿Cómo se juega?"
              title="¿Cómo se juega?"
              className="jt-detail-icon-btn"
              style={{ top: 12, right: 12 }}
            >
              <HelpIcon />
            </button>
          )}

          {meta && <span className="jt-detail-time-badge">{meta.minutes}</span>}
        </div>

        <div className="jt-detail-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
            <h2 className="jt-detail-title">{game.label}</h2>
            {game.category && <span className="jt-detail-category-pill">{CATEGORY_LABEL[game.category] ?? game.category}</span>}
          </div>

          {meta?.players && <p className="jt-detail-players">{meta.players}</p>}

          <p className="jt-detail-desc">{meta?.tagline ?? game.description}</p>

          {isUnderMaintenance(game) ? (
            <Btn disabled variant="ghost">
              En mantenimiento
            </Btn>
          ) : game.comingSoon ? (
            <Btn disabled variant="ghost">
              Más información próximamente
            </Btn>
          ) : (
            <Btn onClick={onStart} variant="success" className="jt-home-cta-btn">
              Jugar
            </Btn>
          )}
        </div>
      </DialogFrame>

      {showRules && <GameRules rules={game.rules} onClose={() => setShowRules(false)} />}
    </>
  );
}

const imgStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
