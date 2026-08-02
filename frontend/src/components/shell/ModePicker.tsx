import { S } from "../../theme/styles";
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
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}>
      <div
        className="jt-animate-drift"
        style={{
          position: "absolute",
          left: "8%",
          bottom: "-10%",
          width: "30vw",
          height: "30vw",
          maxWidth: 360,
          maxHeight: 360,
          minWidth: 180,
          minHeight: 180,
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--jt-accent, #7f77dd) 22%, transparent)",
          filter: "blur(90px)",
        }}
      />
      <div
        className="jt-animate-drift"
        style={{
          position: "absolute",
          right: "10%",
          bottom: "5%",
          width: "26vw",
          height: "26vw",
          maxWidth: 320,
          maxHeight: 320,
          minWidth: 160,
          minHeight: 160,
          borderRadius: "50%",
          background: "color-mix(in srgb, #1d9e75 18%, transparent)",
          filter: "blur(100px)",
          animationDelay: "-6s",
        }}
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
    <div style={{ padding: "24px 0 12px", position: "relative" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <h2
          style={{
            ...S.title,
            fontSize: 22,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            transform: "scaleY(1.12)",
            transformOrigin: "center",
          }}
        >
          ¿Cómo querés jugar?
        </h2>
        <p style={{ color: "var(--jt-muted-text, #6b6490)", fontSize: 13, lineHeight: 1.5, margin: "12px 0 0" }}>
          Online para jugar cada uno desde su celular, o local con un solo dispositivo entre todos.
        </p>
      </div>

      <div className="jt-mode-grid">
        <div className="jt-mode-card" onClick={onSelectMulti}>
          <div style={{ ...S.modeIconBadge, background: "var(--jt-accent, #7F77DD)" }}>
            <PlusIcon />
          </div>
          <div>
            <p style={{ ...S.modeRowTitle, fontSize: 15 }}>Jugar online con amigos</p>
            <p style={S.modeRowSubtitle}>Creá una sala o unite con un código, cada uno desde su celular</p>
          </div>
          <span className="jt-mode-card-cta">
            Elegir
            <ChevronRightIcon color="var(--jt-accent-strong, #AFA9EC)" />
          </span>
        </div>

        <div className="jt-mode-card jt-mode-row-disabled" aria-disabled="true" title="Todavía en desarrollo">
          <div style={{ ...S.modeIconBadge, background: "var(--jt-muted, #5a5280)", boxShadow: "none" }}>
            <SearchIcon />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ ...S.modeRowTitle, fontSize: 15, margin: 0 }}>Unirme a una partida online</p>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--jt-muted-text, #6b6490)",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid var(--jt-card-border, rgba(127,119,221,0.18))",
                  borderRadius: 999,
                  padding: "2px 8px",
                  flexShrink: 0,
                }}
              >
                En desarrollo
              </span>
            </div>
            <p style={{ ...S.modeRowSubtitle, marginTop: 6 }}>Entrá a una sala pública con otros jugadores</p>
          </div>
        </div>

        <div className="jt-mode-card" onClick={onSelectLocal}>
          <div style={{ ...S.modeIconBadge, background: "var(--jt-accent, #7F77DD)" }}>
            <PhoneIcon />
          </div>
          <div>
            <p style={{ ...S.modeRowTitle, fontSize: 15 }}>Jugar en persona</p>
            <p style={S.modeRowSubtitle}>Un solo dispositivo para todo el grupo, se pasa por turnos</p>
          </div>
          <span className="jt-mode-card-cta">
            Elegir
            <ChevronRightIcon color="var(--jt-accent-strong, #AFA9EC)" />
          </span>
        </div>
      </div>
    </div>
  );
}
