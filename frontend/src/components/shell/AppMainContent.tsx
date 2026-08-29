import type { Dispatch, RefObject, SetStateAction } from "react";
import { Outlet } from "react-router-dom";
import type { GameDef } from "../../games/gameTypes";
import type { AppOutletContext } from "../../pages/AppOutletContext";
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
  outletContext: AppOutletContext;
  inGameView: boolean;
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
  outletContext,
  inGameView,
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
    />
  );

  const rest = (
    <>
      {showRules && (game?.rules?.length ?? 0) > 0 && <GameRules rules={game!.rules} onClose={() => setShowRules(false)} />}

      <ScreenFade transitionKey={stepKey} direction={stepDirection} skipAnimation={curtain !== "none"}>
        <Outlet context={outletContext} />
      </ScreenFade>
    </>
  );

  return <AppShellLayout stepKey={stepKey} game={game} inGameView={inGameView} header={header} rest={rest} />;
}
