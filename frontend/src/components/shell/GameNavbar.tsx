import type { CSSProperties, RefObject } from "react";
import { useState } from "react";
import { CloseIcon, BackArrowIcon } from "../ui/icons";
import type { GameDef } from "../../games/gameTypes";
import type { RoomRoster } from "../../pages/context/GameSessionContext";
import { RoomPlayersDialog } from "./RoomPlayersDialog";
import logo from "../../assets/brand/logo.webp";

interface GameNavbarProps {
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  game: GameDef | null | undefined;
  accentColor: string;
  mutedColor: string;
  onBack: () => void;
  onExit: () => void;
  showRules: boolean;
  onToggleRules: () => void;
  backLabel: string;
  // Only non-null while actually attached to an online room (any phase) —
  // see GameSessionContext's RoomRoster doc. Drives the "Jugadores" button
  // below; absent (local mode, or no room yet) hides it entirely.
  roomRoster: RoomRoster | null;
  roomActionRef: RefObject<(msg: Record<string, unknown>) => void>;
}

const NAV_ICON_BTN =
  "flex-shrink-0 flex items-center justify-center rounded-full w-[34px] h-[34px] min-[900px]:w-10 min-[900px]:h-10 font-bold cursor-pointer font-[inherit] scale-100 transition-[transform,filter,background] duration-150 bg-jt-accent-soft border border-jt-accent-border-soft text-jt-accent-strong hover:scale-[1.08] hover:brightness-[1.2] hover:!bg-jt-accent-border-soft active:scale-[0.92] active:brightness-95";

// Chip del logo/ícono del juego en la navbar compacta — mismo lenguaje visual
// que la miniatura de las cards del catálogo (GamePicker: catalogThumb, radial
// gradient del acento + borde + glow) en vez de una imagen suelta sin fondo,
// para que este navbar se sienta parte del mismo sistema que el resto del home
// y no un componente aparte. `accentColor` es un color real por juego (viene
// de useGameTheme, no un token fijo) — no hay forma de generar una clase
// Tailwind de antemano para un valor que solo se conoce en runtime, así que
// el gradiente/borde/sombra siguen en `style` a propósito.
function ingameIconWrap(accentColor: string): CSSProperties {
  return {
    background: `radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, ${accentColor} 26%, transparent), transparent 70%)`,
    border: `1px solid color-mix(in srgb, ${accentColor} 35%, transparent)`,
    boxShadow: `0 8px 20px -12px color-mix(in srgb, ${accentColor} 65%, transparent)`,
  };
}

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
  className: "block",
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

function UsersIcon() {
  return (
    <svg {...iconProps}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/**
 * Cualquier pantalla con un juego ya elegido — desde "Elegí cómo jugar"
 * (mode todavía null) hasta la propia partida (`inGameView`) — comparte
 * esta misma navbar compacta: logo/nombre del juego a la izquierda,
 * Volver/Menú/Reglas como iconos redondos a la derecha. Antes el paso de
 * "elegí modo" tenía su propio look "hero" grande y centrado; unificarlo
 * acá deja el centro de la pantalla libre para el `ModePicker` (o el
 * juego en sí) en todos los pasos, no solo una vez adentro. El flujo de
 * grupo (crear/unirse sin un juego puntual todavía) usa la misma navbar
 * — game es null ahí, así que cae al logo/"Juntada" por defecto.
 *
 * Ver AppHeader.tsx para la rama complementaria (HomeNavbar) y el
 * criterio que decide cuál de las dos se renderiza. Reemplaza a HomeNavbar
 * de un tirón en ese cambio — el subtítulo (ej. "Grupo") ya está en pantalla
 * desde el primer frame, así que animar la OPACIDAD del fondo (como se hizo
 * en un intento previo) deja una ventana semi-transparente durante toda la
 * animación: ese texto en negrita se alcanza a leer a través del scrim, que
 * es justo lo que había que evitar. Acá el fondo queda opaco fijo desde el
 * frame 0 (nunca anima su opacidad) y solo el `backdrop-filter` blur crece
 * de 0 al valor final (`jt-navbar-blur-in`, mismo criterio que el scrim de
 * GroupEntryModal/RoomEntryModal con `jt-modal-scrim-in`) — el tinte oscuro
 * ya tapa todo, el blur solo termina de asentar el efecto vidrio esmerilado.
 */
export function GameNavbar({
  mode,
  groupFlow,
  game,
  accentColor,
  mutedColor,
  onBack,
  onExit,
  showRules,
  onToggleRules,
  backLabel,
  roomRoster,
  roomActionRef,
}: GameNavbarProps) {
  const [showPlayers, setShowPlayers] = useState(false);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-20 border-b border-jt-accent-border-soft
        bg-[color-mix(in_srgb,var(--jt-bg)_78%,transparent)] animate-[jt-navbar-blur-in_100ms_ease-out_forwards] motion-reduce:backdrop-blur-[14px] motion-reduce:animate-none"
    >
      <div className="jt-home-navbar-inner flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="jt-ingame-logo flex items-center justify-center flex-shrink-0 overflow-hidden w-9 h-9 rounded-[10px] min-[900px]:w-11 min-[900px]:h-11 min-[900px]:rounded-xl transition-[transform,filter] duration-150"
            style={ingameIconWrap(accentColor)}
          >
            {game?.logo ? (
              <img src={game.logo} alt="" className="w-full h-full object-cover" />
            ) : game?.icon ? (
              <span className="text-[22px] leading-none">{game.icon}</span>
            ) : (
              <img src={logo} alt="" className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex flex-col leading-[1.15] min-w-0">
            <span
              className="text-base min-[900px]:text-lg font-extrabold tracking-[-0.02em] whitespace-nowrap overflow-hidden text-ellipsis"
              style={{
                backgroundImage: `linear-gradient(100deg, color-mix(in srgb, ${accentColor} 100%, white 30%) 0%, ${accentColor} 55%, color-mix(in srgb, ${accentColor} 100%, white 30%) 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              {game?.label ?? "Juntada"}
            </span>
            <span className="text-[10px] min-[900px]:text-xs font-bold tracking-[0.06em] uppercase" style={{ color: mutedColor }}>
              {groupFlow ? "Grupo" : mode === "local" ? "Local · un dispositivo" : mode === "multi" ? "Online" : "Elegí cómo jugar"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {roomRoster && (
            <button onClick={() => setShowPlayers(true)} className={NAV_ICON_BTN} aria-label="Jugadores" title="Jugadores">
              <UsersIcon />
            </button>
          )}
          {(game?.rules?.length ?? 0) > 0 && (
            <button onClick={onToggleRules} className={NAV_ICON_BTN} aria-label="¿Cómo se juega?" title="¿Cómo se juega?">
              {showRules ? <CloseIcon size={18} /> : <HelpIcon />}
            </button>
          )}
          <button onClick={onBack} className={NAV_ICON_BTN} aria-label={backLabel} title={backLabel}>
            <BackArrowIcon size={18} />
          </button>
          <button onClick={onExit} className={NAV_ICON_BTN} aria-label="Menú principal" title="Menú principal">
            <HomeIcon />
          </button>
        </div>
      </div>

      {showPlayers && roomRoster && (
        <RoomPlayersDialog
          roster={roomRoster}
          onClose={() => setShowPlayers(false)}
          onTransferHost={id => roomActionRef.current?.({ type: "transfer_host", targetId: id })}
          onKickPlayer={id => roomActionRef.current?.({ type: "kick_player", targetId: id })}
        />
      )}
    </div>
  );
}
