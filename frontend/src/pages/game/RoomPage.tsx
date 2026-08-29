import { MultiplayerGame } from "../../features/multiplayer/MultiplayerGame";
import { useMultiplayerEntryProps } from "../../hooks/navigation/useMultiplayerEntryProps";

// Paso 3 (mode === "multi", entrada por sala directa — no grupo): extraído
// verbatim de la mitad "room" del bloque
// `mode === "multi" && (gameId || groupFlow)` en App.tsx, donde
// `entryKind={groupFlow ? "group" : "room"}` decidía cuál de las dos formas
// mostrar. Ese guard original se partió en dos guards complementarios que
// juntos reconstruyen el original exacto: acá `gameId && !groupFlow`
// (entryKind siempre "room"), en GroupPage `groupFlow` (entryKind siempre
// "group"). Guard preservado tal cual — ver nota de "one-render lag" en
// design.md.
export function RoomPage() {
  const { mode, gameId, groupFlow, props } = useMultiplayerEntryProps();

  if (!(mode === "multi" && gameId && !groupFlow)) return null;

  return <MultiplayerGame entryKind="room" {...props} />;
}
