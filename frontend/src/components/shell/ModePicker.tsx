import clsx from "clsx";
import { T } from "../../theme/styles/classes";
import { DEFAULT_COLORS } from "../../theme/styles/colors";
import "../../theme/modeRow.css";

interface ModePickerProps {
  onSelectMulti: () => void;
  onSelectLocal: () => void;
}

// SVGs en línea (Feather-style, trazo blanco) en vez de emoji — mismo
// criterio que los íconos del navbar en AppHeader.tsx.
const rowIconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "#fff",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function PlusIcon() {
  return (
    <svg {...rowIconProps}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg {...rowIconProps}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...rowIconProps}>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="11" y1="18.5" x2="13" y2="18.5" />
    </svg>
  );
}

function ChevronRightIcon({ color }: { color: string }) {
  return (
    <svg
      className="jt-mode-row-chevron"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Blobs animados de fondo del paso "elegí cómo jugar" — separados de
 * `ModePicker` (no anidados dentro suyo) por el mismo motivo que
 * `HeroBackdrop` en Hero.tsx: `ModePicker` vive dentro del `<ScreenFade>` de
 * App.tsx, que anima con `transform` los primeros 0.32s de cada pantalla, y
 * eso atrapa cualquier `position: fixed` de acá adentro (lo mal ubica un
 * instante, y lo hace "saltar" de golpe cuando la animación termina). Ver el
 * comentario completo en Hero.tsx.
 */
export function ModePickerBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className={clsx(
          "jt-animate-drift absolute bottom-[-10%] left-[8%] h-[30vw] max-h-[360px] min-h-[180px] w-[30vw] max-w-[360px] min-w-[180px] rounded-full blur-[90px]",
          `bg-[color-mix(in_srgb,var(--jt-accent,${DEFAULT_COLORS.accent})_22%,transparent)]`,
        )}
      />
      <div
        className="jt-animate-drift absolute bottom-[5%] right-[10%] h-[26vw] max-h-[320px] min-h-[160px] w-[26vw] max-w-[320px] min-w-[160px] rounded-full bg-[color-mix(in_srgb,#1d9e75_18%,transparent)] blur-[100px]"
        style={{ animationDelay: "-6s" }}
      />
    </div>
  );
}

/**
 * "Paso 2" — se muestra una vez elegido un juego pero antes de elegir un
 * modo, solo para los juegos que realmente soportan ambos (ver el gate
 * `!localOnly` de App.tsx). Usa los colores/variables del tema activo (ver
 * `useGameTheme`) cuando lo hay, y los de la app por defecto si no — nunca
 * colores fijos de un juego en particular. Su fondo animado vive en
 * `ModePickerBackdrop` de acá arriba, renderizado aparte por App.tsx.
 *
 * "Unirme a una partida online" se muestra pero deshabilitada (todavía en
 * desarrollo): entrar a una sala pública sin código propio no está
 * implementado del lado del servidor todavía — `onSelectMulti` hoy solo
 * cubre crear una sala y compartir el código.
 */
export function ModePicker({ onSelectMulti, onSelectLocal }: ModePickerProps) {
  return (
    <div className="relative pb-3 pt-6">
      <div className="mb-9 text-center">
        <h2 className={clsx(T.title, "origin-center scale-y-[1.12] text-[22px] uppercase tracking-[-0.01em]")}>¿Cómo querés jugar?</h2>
        <p className="mt-3 text-[13px] leading-[1.5]" style={{ color: `var(--jt-muted-text, ${DEFAULT_COLORS.mutedText})` }}>
          Online para jugar cada uno desde su celular, o local con un solo dispositivo entre todos.
        </p>
      </div>

      <div className="jt-mode-grid">
        <div className="jt-mode-card" onClick={onSelectMulti}>
          <div className={clsx(T.modeIconBadge, `bg-[var(--jt-accent,${DEFAULT_COLORS.accent})]`)}>
            <PlusIcon />
          </div>
          <div>
            <p className={clsx(T.modeRowTitle, "text-[15px]")}>Jugar online con amigos</p>
            <p className={T.modeRowSubtitle}>Creá una sala o unite con un código, cada uno desde su celular</p>
          </div>
          <span className="jt-mode-card-cta">
            Elegir
            <ChevronRightIcon color={`var(--jt-accent-strong, ${DEFAULT_COLORS.accentStrong})`} />
          </span>
        </div>

        <div className="jt-mode-card jt-mode-row-disabled" aria-disabled="true" title="Todavía en desarrollo">
          <div className={clsx(T.modeIconBadge, "shadow-none", `bg-[var(--jt-muted,${DEFAULT_COLORS.muted})]`)}>
            <SearchIcon />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className={clsx(T.modeRowTitle, "m-0 text-[15px]")}>Unirme a una partida online</p>
              <span
                className="shrink-0 rounded-full border border-[var(--jt-card-border,rgba(127,119,221,0.18))] bg-white/[0.06] px-2 py-0.5 text-[10px] font-bold"
                style={{ color: `var(--jt-muted-text, ${DEFAULT_COLORS.mutedText})` }}
              >
                En desarrollo
              </span>
            </div>
            <p className={clsx(T.modeRowSubtitle, "mt-1.5")}>Entrá a una sala pública con otros jugadores</p>
          </div>
        </div>

        <div className="jt-mode-card" onClick={onSelectLocal}>
          <div className={clsx(T.modeIconBadge, `bg-[var(--jt-accent,${DEFAULT_COLORS.accent})]`)}>
            <PhoneIcon />
          </div>
          <div>
            <p className={clsx(T.modeRowTitle, "text-[15px]")}>Jugar en persona</p>
            <p className={T.modeRowSubtitle}>Un solo dispositivo para todo el grupo, se pasa por turnos</p>
          </div>
          <span className="jt-mode-card-cta">
            Elegir
            <ChevronRightIcon color={`var(--jt-accent-strong, ${DEFAULT_COLORS.accentStrong})`} />
          </span>
        </div>
      </div>
    </div>
  );
}
