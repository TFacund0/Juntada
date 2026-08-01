import type { GameTheme } from "../../theme/gameThemes";

/**
 * Fondo de pantalla completa detrás de toda la app: la cortina de
 * transición entre temas, y el backdrop (imagen o emoji gigante) del tema
 * activo, si el juego en pantalla tiene uno. Extraído de App.tsx tal cual —
 * puramente decorativo, no lee ni escribe ningún estado de navegación.
 */
export function AppBackdrop({
  curtain,
  activeTheme,
  accentColor,
}: {
  curtain: "none" | "in" | "out";
  activeTheme: GameTheme | null | undefined;
  accentColor: string | undefined;
}) {
  return (
    <>
      {curtain !== "none" && <div className={`app-curtain ${curtain}`} />}
      {activeTheme?.backdropImage ? (
        <img
          aria-hidden
          src={activeTheme.backdropImage}
          alt=""
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: 0.1,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      ) : (
        activeTheme?.backdropEmoji && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "60vh",
              lineHeight: 1,
              opacity: 0.07,
              color: accentColor,
              userSelect: "none",
              pointerEvents: "none",
            }}
          >
            {activeTheme.backdropEmoji}
          </div>
        )
      )}
    </>
  );
}
