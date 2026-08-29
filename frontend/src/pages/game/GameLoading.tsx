import { Spinner } from "../../components/ui/Spinner";
import { DEFAULT_COLORS } from "../../theme/styles/colors";

// Fallback de <Suspense> mientras carga el chunk de un juego — extraído
// verbatim de App.tsx (misma función, mismo JSX), compartido entre las
// páginas de juego (LocalGamePage, LocalOnlyGamePage, RoomPage, GroupPage).
export function GameLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 40 }}>
      <Spinner />
      <p style={{ margin: 0, color: `var(--jt-muted-text, ${DEFAULT_COLORS.mutedText})`, fontSize: 14 }}>Cargando juego...</p>
    </div>
  );
}
