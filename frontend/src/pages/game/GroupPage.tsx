import { MultiplayerGame } from "../../features/multiplayer/MultiplayerGame";
import { useMultiplayerEntryProps } from "../../hooks/navigation/useMultiplayerEntryProps";

// Paso 3 (mode === "multi", flujo de grupo): extraído verbatim de la mitad
// "group" del bloque `mode === "multi" && (gameId || groupFlow)` en
// App.tsx — ver el comentario en RoomPage sobre cómo se partió ese guard
// original en dos. Acá el guard es `groupFlow` sola (entryKind siempre
// "group", como en el original cuando groupFlow era truthy, sin importar
// gameId). Guard preservado tal cual — ver nota de "one-render lag" en
// design.md.
export function GroupPage() {
  const { mode, groupFlow, props } = useMultiplayerEntryProps();

  if (!(mode === "multi" && groupFlow)) return null;

  return <MultiplayerGame entryKind="group" {...props} />;
}
