import type { MultiplayerGameProps } from "../../features/multiplayer/MultiplayerGame";
import { useGameSessionContext, type GameSessionContextValue } from "../../pages/context/GameSessionContext";
import { useGameBridgeContext } from "../../pages/context/GameBridgeContext";
import { useCurtainContext } from "../../pages/context/CurtainContext";
import { usePlayerSessionContext } from "../../pages/context/PlayerSessionContext";
import { useAppShellContext } from "../../pages/context/AppShellContext";

interface MultiplayerEntry {
  mode: GameSessionContextValue["mode"];
  gameId: GameSessionContextValue["gameId"];
  groupFlow: GameSessionContextValue["groupFlow"];
  props: Omit<MultiplayerGameProps, "entryKind">;
}

// Shared prop wiring for RoomPage/GroupPage — see design.md for
// `sdd/multiplayer-entry-pages-dedup`. Both pages call this hook, keep their
// own guard (byte-identical to the pre-refactor inline block) and pass
// `entryKind` themselves; everything else funnels through here so the two
// entry points can never drift out of sync.
export function useMultiplayerEntryProps(): MultiplayerEntry {
  const {
    gameId,
    mode,
    groupFlow,
    game,
    pendingGroupJoinCode,
    groupIntent,
    handleRoomGameType,
    setRoomPhase,
    setRoomCode,
    setGroupCode,
    switchToGroupJoin,
    setGroupAttached,
    setRoomRoster,
  } = useGameSessionContext();
  const { exposeReturnToGroup, exposeLeaveRoom, exposeRoomAction } = useGameBridgeContext();
  const { withAsyncCurtain, settleAsyncCurtain, curtain } = useCurtainContext();
  const { playerName, savePlayerName, validJoinLink } = usePlayerSessionContext();
  const { goHome, goBack } = useAppShellContext();

  return {
    mode,
    gameId,
    groupFlow,
    props: {
      gameId,
      playerName,
      onChangeName: savePlayerName,
      initialJoinCode: pendingGroupJoinCode ?? validJoinLink?.code,
      initialGroupIntent: groupIntent,
      onGameTypeChange: handleRoomGameType,
      onRoomPhaseChange: setRoomPhase,
      onRoomCodeChange: setRoomCode,
      onGroupCodeChange: setGroupCode,
      onLeaveGroup: goHome,
      onExitRoomEntry: goBack,
      onGoHome: goHome,
      onSwitchToGroup: switchToGroupJoin,
      onGroupAttachedChange: setGroupAttached,
      onExposeReturnToGroup: exposeReturnToGroup,
      onExposeLeaveRoom: exposeLeaveRoom,
      onExposeRoomAction: exposeRoomAction,
      onRoomRosterChange: setRoomRoster,
      runTransition: (action, themedOverride) => withAsyncCurtain(action, themedOverride ?? Boolean(game?.gameTheme)),
      onTransitionSettled: settleAsyncCurtain,
      curtain,
    },
  };
}
