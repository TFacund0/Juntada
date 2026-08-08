/**
 * Íconos en línea (Feather-style: viewBox 24, trazo currentColor por
 * defecto) compartidos por varios lugares no relacionados entre sí —
 * `CloseIcon` cierra `GameRules`, `GroupEntryModal`/`RoomEntryModal` y el
 * "Reglas" de `AppHeader`; `BackArrowIcon` es la flecha de "Volver" de
 * `AppHeader` y el tone="back" de `ConfirmDialog`. Antes cada uno tenía su
 * propio `<svg>` inline con el mismo `path`, solo cambiando tamaño/color —
 * un cambio de trazo (grosor, redondeo de puntas) tenía que repetirse a
 * mano en cada copia en vez de tocarse en un solo lugar.
 *
 * SVG en vez de un glifo de texto ("✕"/"←"): un glifo trae su propio
 * ascenso/descenso tipográfico y queda descentrado dentro de un botón
 * circular aunque el botón esté centrado por flexbox — un SVG con
 * `display: block` se centra siempre igual sin importar la fuente del
 * dispositivo.
 */
interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function CloseIcon({ size = 14, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function BackArrowIcon({ size = 18, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/** Flecha diagonal — botón "Compartir enlace" de LobbyScreen. */
export function ShareArrowIcon({ size = 16, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

/** "+" — ícono del trigger "Nueva partida" en GroupScreen (mobile). */
export function PlusIcon({ size = 18, color = "currentColor", strokeWidth = 2.5 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/** Corona — badge de "Anfitrión" sobre el avatar en GroupScreen. */
export function CrownIcon({ size = 12, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      {/* El path original (pico más arriba que la base) deja más aire arriba
          que abajo dentro del viewBox de 24×24 — se nota en un badge chico
          como jt-group-host-badge, donde queda todo el ícono. Se traslada
          1px hacia arriba para centrar el bounding box real (5..21) en el
          viewBox en vez de dejarlo pegado hacia abajo. */}
      <g transform="translate(0 -1)">
        <path d="m2 18 2-11 5 4 3-6 3 6 5-4 2 11z" />
        <line x1="4" y1="21" x2="20" y2="21" />
      </g>
    </svg>
  );
}

/** Expulsar integrante — menú de opciones de GroupScreen. */
export function UserMinusIcon({ size = 14, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M13 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="7" cy="7" r="4" />
      <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
  );
}

/** Ícono de alerta — ConfirmDialog (tone="exit") y ErrorBanner. */
export function AlertIcon({ size = 22, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** Lupa de búsqueda — campo de búsqueda de GamePicker. */
export function SearchIcon({ size = 16, color = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/** Chevron colapsable — encabezado de sección de categoría de GamePicker. */
export function ChevronDownIcon({ size = 14, color = "currentColor", strokeWidth = 2, open }: IconProps & { open?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
