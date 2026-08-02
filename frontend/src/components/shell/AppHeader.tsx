import type { CSSProperties, RefObject } from "react";
import { Avatar } from "../ui/Avatar";
import { CloseIcon, BackArrowIcon } from "../ui/icons";
import { ProfilePanel } from "./ProfilePanel";
import { GroupMenuDropdown } from "./GroupMenuDropdown";
import type { GameDef } from "../../games/gameTypes";
import logo from "../../assets/brand/logo.webp";
import "./AppHeader.css";

interface AppHeaderProps {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  // Con esto (y gameId) es como goBack (useAppNavigation) decide si "Volver"
  // manda de vuelta a la pantalla de grupo en vez de salir del juego — el
  // ícono/tooltip acá reflejan la misma condición para no prometer una
  // acción con la flecha y hacer otra al tocarla.
  groupAttached: boolean;
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

// width/height NO van acá adentro (a propósito): quedan en la clase
// .jt-nav-icon-btn (AppHeader.css) con su propio @media, porque un tamaño
// puesto por `style` inline le gana siempre a cualquier regla de una hoja de
// estilos — incluida una en un @media — así que si el tamaño va inline nunca
// puede crecer en pantallas grandes.
const navIconBtn = (accentColor: string): CSSProperties => ({
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

// Chip del logo/ícono del juego en la navbar compacta — mismo lenguaje visual
// que la miniatura de las cards del catálogo (GamePicker: catalogThumb, radial
// gradient del acento + borde + glow) en vez de una imagen suelta sin fondo,
// para que este navbar se sienta parte del mismo sistema que el resto del home
// y no un componente aparte.
const ingameIconWrap = (accentColor: string): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "hidden",
  background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, ${accentColor} 26%, transparent), transparent 70%)`,
  border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
  boxShadow: `0 8px 20px -12px color-mix(in srgb, ${accentColor} 65%, transparent)`,
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

function HomeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
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
  groupAttached,
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
  // Misma condición que goBack (useAppNavigation): con un grupo activo y una
  // instancia puntual en pantalla, "Volver" no sale del juego, manda de
  // vuelta a la pantalla de grupo.
  const backGoesToGroup = groupAttached && !!gameId;
  const backLabel = backGoesToGroup ? "Volver al grupo" : "Volver";

  if (isHome) {
    // fixed (no sticky) — sticky depende de la altura del padre y de que
    // ningún ancestro tenga overflow, y esas condiciones son frágiles a
    // través de varios wrappers; fixed queda anclado a la ventana sin
    // ambigüedad. El padding-top del contenido (ver App.tsx) compensa el
    // espacio que este navbar deja de ocupar en el flujo normal.
    return (
      <div
        className="jt-home-navbar"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: "color-mix(in srgb, var(--jt-bg, #0f0c1d) 78%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          className="jt-home-navbar-inner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <img
              src={logo}
              alt=""
              className="jt-home-logo"
              style={{
                borderRadius: 11,
                flexShrink: 0,
                boxShadow: "0 8px 24px -12px color-mix(in srgb, var(--jt-accent, #7f77dd) 90%, transparent)",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, minWidth: 0 }}>
              <span className="jt-text-gradient" style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.03em" }}>
                Juntada
              </span>
              <span
                className="jt-home-subtitle"
                style={{
                  fontWeight: 600,
                  color: mutedColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Hola, {playerName}
              </span>
            </div>
          </div>
          <div className="jt-home-actions" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <nav className="jt-home-nav" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <button onClick={() => onStartGroupFlow("join")} className="jt-home-nav-link" style={{ border: "none", background: "none" }}>
                Unirme
              </button>
              <button onClick={() => onStartGroupFlow("create")} className="jt-cta-gradient jt-home-cta-btn">
                Crear grupo
              </button>
              {/* Por debajo del breakpoint (ver GroupMenuDropdown.css), estos
                  dos botones se esconden y este trigger + menú ocupan su
                  lugar — así "Juntada" nunca se queda sin espacio ni se
                  superpone con nada. */}
              <GroupMenuDropdown onStartGroupFlow={onStartGroupFlow} />
            </nav>
            <div ref={groupMenuRef} className="jt-home-profile-wrap" style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={onToggleGroupMenu} className="jt-profile-trigger" aria-label="Tu perfil" title="Tu perfil">
                <Avatar name={playerName} size={30} />
              </button>
              {showGroupMenu && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 5 }}>
                  <ProfilePanel playerName={playerName} onSavePlayerName={onSavePlayerName} />
                </div>
              )}
            </div>
          </div>
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
    // Mismo criterio que el navbar del home (ver arriba): fixed + ancho
    // completo de la ventana, con el contenido interno alineado vía
    // jt-home-navbar-inner (AppHeader.css) en vez de quedarse fijo en 480px
    // — texto/logo/iconos también escalan vía las clases jt-ingame-* /
    // jt-nav-icon-btn (AppHeader.css), no por `style` inline, porque un
    // tamaño inline nunca puede perder contra un @media.
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: "color-mix(in srgb, var(--jt-bg, #0f0c1d) 78%, transparent)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid var(--jt-accent-border-soft, rgba(127,119,221,0.15))",
        }}
      >
        <div
          className="jt-home-navbar-inner"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div className="jt-ingame-logo" style={ingameIconWrap(accentColor)}>
              {game?.logo ? (
                <img src={game.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : game?.icon ? (
                <span style={{ fontSize: 22, lineHeight: 1 }}>{game.icon}</span>
              ) : (
                <img src={logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15, minWidth: 0 }}>
              <span
                className="jt-ingame-title"
                style={{
                  backgroundImage: `linear-gradient(100deg, color-mix(in srgb, ${accentColor} 100%, white 30%) 0%, ${accentColor} 55%, color-mix(in srgb, ${accentColor} 100%, white 30%) 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  letterSpacing: "-0.02em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {game?.label ?? "Juntada"}
              </span>
              <span
                className="jt-ingame-subtitle"
                style={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: mutedColor }}
              >
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
                {showRules ? <CloseIcon size={18} /> : <HelpIcon />}
              </button>
            )}
            <button onClick={onBack} className="jt-nav-icon-btn" style={navIconBtn(accentColor)} aria-label={backLabel} title={backLabel}>
              <BackArrowIcon size={18} />
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
      </div>
    );
  }

  // isHome y (gameId || groupFlow) son exhaustivos: no queda un tercer caso.
  return null;
}
