import { useOutletContext } from "react-router-dom";
import { MultiplayerGame } from "../features/multiplayer/MultiplayerGame";
import type { AppOutletContext } from "./AppOutletContext";

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
  const {
    gameId,
    mode,
    groupFlow,
    game,
    playerName,
    savePlayerName,
    pendingGroupJoinCode,
    validJoinLink,
    groupIntent,
    handleRoomGameType,
    setRoomPhase,
    setRoomCode,
    setGroupCode,
    goHome,
    goBack,
    switchToGroupJoin,
    setGroupAttached,
    exposeReturnToGroup,
    withAsyncCurtain,
    settleAsyncCurtain,
    curtain,
  } = useOutletContext<AppOutletContext>();

  if (!(mode === "multi" && gameId && !groupFlow)) return null;

  return (
    <MultiplayerGame
      entryKind="room"
      gameId={gameId}
      playerName={playerName}
      onChangeName={savePlayerName}
      initialJoinCode={pendingGroupJoinCode ?? validJoinLink?.code}
      initialGroupIntent={groupIntent}
      onGameTypeChange={handleRoomGameType}
      onRoomPhaseChange={setRoomPhase}
      onRoomCodeChange={setRoomCode}
      onGroupCodeChange={setGroupCode}
      onLeaveGroup={goHome}
      onExitRoomEntry={goBack}
      onGoHome={goHome}
      onSwitchToGroup={switchToGroupJoin}
      onGroupAttachedChange={setGroupAttached}
      onExposeReturnToGroup={exposeReturnToGroup}
      runTransition={(action, themedOverride) => withAsyncCurtain(action, themedOverride ?? Boolean(game?.gameTheme))}
      onTransitionSettled={settleAsyncCurtain}
      curtain={curtain}
    />
  );
}
