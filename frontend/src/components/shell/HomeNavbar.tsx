import type { RefObject } from "react";
import { Avatar } from "../ui/Avatar";
import { ProfilePanel } from "./ProfilePanel";
import { GroupMenuDropdown } from "./GroupMenuDropdown";
import logo from "../../assets/brand/logo.webp";
import { DEFAULT_COLORS } from "../../theme/styles/colors";

interface HomeNavbarProps {
  mutedColor: string;
  playerName: string;
  onSavePlayerName: (name: string) => void;
  showProfileMenu: boolean;
  onToggleProfileMenu: () => void;
  profileMenuRef: RefObject<HTMLDivElement>;
  onStartGroupFlow: (intent: "create" | "join") => void;
}

/**
 * Menú principal (elegir juego, sin juego ni grupo activo): una navbar con
 * el logo, "Juntada" y el nombre del jugador (como subtítulo) pegados a la
 * izquierda, y a la derecha un ícono redondo de menú — cambiar nombre y
 * crear/unirse a un grupo viven dentro de ese desplegable en vez de ocupar
 * espacio vertical propio, dejando el centro de la pantalla libre para la
 * grilla de juegos.
 *
 * Ver AppHeader.tsx para la rama complementaria (GameNavbar) y el criterio
 * que decide cuál de las dos se renderiza.
 */
export function HomeNavbar({
  mutedColor,
  playerName,
  onSavePlayerName,
  showProfileMenu,
  onToggleProfileMenu,
  profileMenuRef,
  onStartGroupFlow,
}: HomeNavbarProps) {
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
        background: `color-mix(in srgb, var(--jt-bg, ${DEFAULT_COLORS.bg}) 78%, transparent)`,
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
              boxShadow: `0 8px 24px -12px color-mix(in srgb, var(--jt-accent, ${DEFAULT_COLORS.accent}) 90%, transparent)`,
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
          <div ref={profileMenuRef} className="jt-home-profile-wrap" style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={onToggleProfileMenu} className="jt-profile-trigger" aria-label="Tu perfil" title="Tu perfil">
              <Avatar name={playerName} size={30} />
            </button>
            {showProfileMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 5 }}>
                <ProfilePanel playerName={playerName} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
