import { useOutletContext } from "react-router-dom";
import { MultiplayerGame } from "../../features/multiplayer/MultiplayerGame";
import type { AppOutletContext } from "../AppOutletContext";

// Paso 3 (mode === "multi", flujo de grupo): extraído verbatim de la mitad
// "group" del bloque `mode === "multi" && (gameId || groupFlow)` en
// App.tsx — ver el comentario en RoomPage sobre cómo se partió ese guard
// original en dos. Acá el guard es `groupFlow` sola (entryKind siempre
// "group", como en el original cuando groupFlow era truthy, sin importar
// gameId). Guard preservado tal cual — ver nota de "one-render lag" en
// design.md.
export function GroupPage() {
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

  if (!(mode === "multi" && groupFlow)) return null;

  return (
    <MultiplayerGame
      entryKind="group"
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
