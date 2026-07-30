import type { CSSProperties, RefObject } from "react";
import { S } from "../theme/styles";
import { NamePillEditor } from "./NamePillEditor";
import type { GameDef } from "../games/gameTypes";
import logo from "../assets/brand/logo.webp";
import "./AppHeader.css";

interface AppHeaderProps {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  game: GameDef | null | undefined;
  accentColor: string;
  mutedColor: string;
  playerName: string;
  onSavePlayerName: (name: string) => void;
  onBack: () => void;
  onExit: () => void;
  showGroupMenu: boolean;
  onToggleGroupMenu: () => void;
  groupMenuRef: RefObject<HTMLDivElement>;
  onStartGroupFlow: (intent: "create" | "join") => void;
  showRules: boolean;
  onToggleRules: () => void;
}

const navIconBtn = (accentColor: string): CSSProperties => ({
  width: 34,
  height: 34,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "50%",
  background: "var(--jt-accent-soft, rgba(127,119,221,0.1))",
  border: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.3))",
  color: "var(--jt-accent-strong, " + accentColor + ")",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "transform 0.15s, filter 0.15s",
});

// Iconos en línea (Feather-style: viewBox 24, trazo currentColor) en vez de
// glifos de texto/emoji — un glifo como "←" o "⌂" trae su propio
// ascenso/descenso tipográfico y queda ópticamente descentrado dentro del
// círculo aunque el botón esté centrado por flexbox; un SVG con
// `display: block` se centra siempre igual sin importar la fuente del
// dispositivo.
const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { display: "block" } as CSSProperties,
};

function HelpIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg {...iconProps}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg {...iconProps}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg {...iconProps}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

/**
 * El header compartido que se muestra arriba de cada pantalla. Tiene dos
 * looks bien distintos:
 * - Menú principal (elegir juego, sin juego ni grupo activo): una navbar
 *   con el logo, "Juntada" y el nombre del jugador (como subtítulo) pegados
 *   a la izquierda, y a la derecha un ícono redondo de menú — cambiar
 *   nombre y crear/unirse a un grupo viven dentro de ese desplegable en vez
 *   de ocupar espacio vertical propio, dejando el centro de la pantalla
 *   libre para la grilla de juegos.
 * - Cualquier pantalla con un juego ya elegido (eligiendo modo, jugando, o
 *   ya en una sala): la misma navbar chica con el logo/nombre del juego
 *   pegados a la izquierda (mismo patrón que la del menú principal) y
 *   Volver/Menú/Reglas como iconos redondos a la derecha — así el centro
 *   de la pantalla queda libre para el `ModePicker`/juego en cualquier
 *   paso, no solo una vez adentro. Solo el flujo neutral de crear/unirse a
 *   un grupo (sin juego puntual todavía) se queda con el look "hero"
 *   grande y centrado de siempre.
 */
export function AppHeader({
  gameId,
  mode,
  groupFlow,
  game,
  accentColor,
  mutedColor,
  playerName,
  onSavePlayerName,
  onBack,
  onExit,
  showGroupMenu,
  onToggleGroupMenu,
  groupMenuRef,
  onStartGroupFlow,
  showRules,
  onToggleRules,
}: AppHeaderProps) {
  const isHome = !gameId && !groupFlow;

  if (isHome) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 0 24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <img src={logo} alt="" style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.045em", color: accentColor }}>Juntada</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: mutedColor,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {playerName}
            </span>
          </div>
        </div>
        <div ref={groupMenuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={onToggleGroupMenu} className="jt-nav-icon-btn" style={navIconBtn(accentColor)} aria-label="Menú" title="Menú">
            <MenuIcon />
          </button>
          {showGroupMenu && (
            <div className="jt-dropdown-menu" style={{ ...S.dropdownMenu, left: "auto", right: 0, width: 240 }}>
              <div style={{ padding: "4px 8px 12px" }}>
                <span style={{ ...S.label, marginBottom: 8 }}>Tu nombre</span>
                <NamePillEditor name={playerName} onSave={onSavePlayerName} />
              </div>
              <div style={{ height: 1, background: "var(--jt-row-border, rgba(127,119,221,0.15))", margin: "0 6px 6px" }} />
              <button onClick={() => onStartGroupFlow("create")} className="jt-dropdown-menu-item" style={S.dropdownMenuItem}>
                ➕ Crear grupo
              </button>
              <button onClick={() => onStartGroupFlow("join")} className="jt-dropdown-menu-item" style={S.dropdownMenuItem}>
                🔗 Unirme a un grupo
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Cualquier pantalla con un juego ya elegido — desde "Elegí cómo jugar"
  // (mode todavía null) hasta la propia partida (`inGameView`) — comparte
  // esta misma navbar compacta: logo/nombre del juego a la izquierda,
  // Volver/Menú/Reglas como iconos redondos a la derecha. Antes el paso de
  // "elegí modo" tenía su propio look "hero" grande y centrado; unificarlo
  // acá deja el centro de la pantalla libre para el `ModePicker` (o el
  // juego en sí) en todos los pasos, no solo una vez adentro. El flujo de
  // grupo (crear/unirse sin un juego puntual todavía) usa la misma navbar
  // — game es null ahí, así que cae al logo/"Juntada" por defecto.
  if (gameId || groupFlow) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 0",
          marginBottom: 18,
          borderBottom: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.15))",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {game?.logo ? (
            <img src={game.logo} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
          ) : game?.icon ? (
            <div style={{ fontSize: 28, lineHeight: 1, flexShrink: 0 }}>{game.icon}</div>
          ) : (
            <img src={logo} alt="" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: accentColor,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {game?.label ?? "Juntada"}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: mutedColor }}>
              {groupFlow ? "Grupo" : mode === "local" ? "Local · un dispositivo" : mode === "multi" ? "Online" : "Elegí cómo jugar"}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {(game?.rules?.length ?? 0) > 0 && (
            <button
              onClick={onToggleRules}
              className="jt-nav-icon-btn"
              style={navIconBtn(accentColor)}
              aria-label="¿Cómo se juega?"
              title="¿Cómo se juega?"
            >
              {showRules ? <CloseIcon /> : <HelpIcon />}
            </button>
          )}
          <button onClick={onBack} className="jt-nav-icon-btn" style={navIconBtn(accentColor)} aria-label="Volver" title="Volver">
            <BackIcon />
          </button>
          <button
            onClick={onExit}
            className="jt-nav-icon-btn"
            style={navIconBtn(accentColor)}
            aria-label="Menú principal"
            title="Menú principal"
          >
            <HomeIcon />
          </button>
        </div>
      </div>
    );
  }

  // isHome y (gameId || groupFlow) son exhaustivos: no queda un tercer caso.
  return null;
}
