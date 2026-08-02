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
