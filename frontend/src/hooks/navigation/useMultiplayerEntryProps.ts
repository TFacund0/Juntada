import { useOutletContext } from "react-router-dom";
import type { MultiplayerGameProps } from "../../features/multiplayer/MultiplayerGame";
import type { AppOutletContext } from "../../pages/AppOutletContext";

interface MultiplayerEntry {
  mode: AppOutletContext["mode"];
  gameId: AppOutletContext["gameId"];
  groupFlow: AppOutletContext["groupFlow"];
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
      runTransition: (action, themedOverride) => withAsyncCurtain(action, themedOverride ?? Boolean(game?.gameTheme)),
      onTransitionSettled: settleAsyncCurtain,
      curtain,
    },
  };
}
