import type { Dispatch, RefObject, SetStateAction } from "react";
import { Outlet } from "react-router-dom";
import type { GameDef } from "../../games/gameTypes";
import type { AppContextValues } from "../../hooks/navigation/useAppContextValues";
import type { RoomRoster } from "../../pages/context/GameSessionContext";
import { GameSessionContext } from "../../pages/context/GameSessionContext";
import { GameBridgeContext } from "../../pages/context/GameBridgeContext";
import { CurtainContext } from "../../pages/context/CurtainContext";
import { PlayerSessionContext } from "../../pages/context/PlayerSessionContext";
import { AppShellContext } from "../../pages/context/AppShellContext";
import { GameRules } from "./GameRules";
import { ScreenFade } from "../ui/ScreenFade";
import { AppHeader } from "./AppHeader";
import { AppShellLayout } from "./AppShellLayout";

interface AppMainContentProps {
  gameId: string | null;
  mode: "local" | "multi" | null;
  groupFlow: boolean;
  groupAttached: boolean;
  game: GameDef | null | undefined;
  accentColor: string;
  mutedColor: string;
  playerName: string;
  savePlayerName: (name: string) => void;
  goBack: () => void;
  setShowExitConfirm: (show: boolean) => void;
  showProfileMenu: boolean;
  setShowProfileMenu: Dispatch<SetStateAction<boolean>>;
  profileMenuRef: RefObject<HTMLDivElement>;
  startGroupFlow: (intent: "create" | "join") => void;
  showRules: boolean;
  setShowRules: Dispatch<SetStateAction<boolean>>;
  stepKey: string;
  stepDirection: "forward" | "back";
  curtain: "none" | "in" | "out";
  contextValues: AppContextValues;
  inGameView: boolean;
  roomRoster: RoomRoster | null;
  roomActionRef: RefObject<(msg: Record<string, unknown>) => void>;
}

/**
 * Absorbs the header/rest composition that used to live as an inline IIFE in
 * App.tsx — builds `header` and `rest` from raw props, conditionally renders
 * GameRules, wraps route transitions in ScreenFade, and delegates the
 * per-step layout decision to AppShellLayout (whose own prop contract is
 * untouched). Output is byte-for-byte identical to the original inline IIFE.
 */
export function AppMainContent({
  gameId,
  mode,
  groupFlow,
  groupAttached,
  game,
  accentColor,
  mutedColor,
  playerName,
  savePlayerName,
  goBack,
  setShowExitConfirm,
  showProfileMenu,
  setShowProfileMenu,
  profileMenuRef,
  startGroupFlow,
  showRules,
  setShowRules,
  stepKey,
  stepDirection,
  curtain,
  contextValues,
  inGameView,
  roomRoster,
  roomActionRef,
}: AppMainContentProps) {
  const header = (
    <AppHeader
      gameId={gameId}
      mode={mode}
      groupFlow={groupFlow}
      groupAttached={groupAttached}
      game={game}
      accentColor={accentColor}
      mutedColor={mutedColor}
      playerName={playerName}
      onSavePlayerName={savePlayerName}
      onBack={goBack}
      onExit={() => setShowExitConfirm(true)}
      showProfileMenu={showProfileMenu}
      onToggleProfileMenu={() => setShowProfileMenu(v => !v)}
      profileMenuRef={profileMenuRef}
      onStartGroupFlow={startGroupFlow}
      showRules={showRules}
      onToggleRules={() => setShowRules(v => !v)}
      roomRoster={roomRoster}
      roomActionRef={roomActionRef}
    />
  );

  const rest = (
    <>
      {showRules && (game?.rules?.length ?? 0) > 0 && <GameRules rules={game!.rules} onClose={() => setShowRules(false)} />}

      <ScreenFade transitionKey={stepKey} direction={stepDirection} skipAnimation={curtain !== "none"}>
        <GameSessionContext.Provider value={contextValues.gameSession}>
          <GameBridgeContext.Provider value={contextValues.gameBridge}>
            <CurtainContext.Provider value={contextValues.curtain}>
              <PlayerSessionContext.Provider value={contextValues.playerSession}>
                <AppShellContext.Provider value={contextValues.appShell}>
                  <Outlet />
                </AppShellContext.Provider>
              </PlayerSessionContext.Provider>
            </CurtainContext.Provider>
          </GameBridgeContext.Provider>
        </GameSessionContext.Provider>
      </ScreenFade>
    </>
  );

  return <AppShellLayout stepKey={stepKey} game={game} inGameView={inGameView} header={header} rest={rest} />;
}
