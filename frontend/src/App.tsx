import clsx from "clsx";
import { T } from "./theme/styles/classes";
import "./theme/tailwind.css";
import "./theme/curtain.css";
import "./theme/sharedChrome.css";
import "./theme/homeDesign.css";
import { AuthScreen } from "./features/auth/screens/AuthScreen";
import { AppMainContent } from "./components/shell/AppMainContent";
import { AppOverlays } from "./components/shell/AppOverlays";
import { useAppOrchestration } from "./hooks/app/useAppOrchestration";
import { useAuth } from "./features/auth/context/AuthContext";

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP — pathless PARENT/layout route. Delegates the 12-hook composition
// to useAppOrchestration and the header/rest/AppShellLayout composition to
// AppMainContent — see pages/context/ for the 5 domain contexts provided
// around <Outlet>. App must stay a single non-remounting parent route
// (remounting on every path change would destroy this state).
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  const { user, loading: authLoading } = useAuth();
  const {
    gameId,
    mode,
    game,
    groupFlow,
    groupAttached,
    inGameView,
    activeTheme,
    accentColor,
    mutedColor,
    curtain,
    stepKey,
    stepDirection,
    playerName,
    savePlayerName,
    goBack,
    confirmGoBack,
    goHome,
    startGroupFlow,
    showProfileMenu,
    setShowProfileMenu,
    profileMenuRef,
    showRules,
    setShowRules,
    showExitConfirm,
    setShowExitConfirm,
    showBackConfirm,
    setShowBackConfirm,
    showLocalResetConfirm,
    setShowLocalResetConfirm,
    showReturnToGroupConfirm,
    setShowReturnToGroupConfirm,
    showDevNotice,
    dismissDevNotice,
    localGameResetRef,
    returnToGroupRef,
    contextValues,
  } = useAppOrchestration();

  // Silent refresh-on-boot (AuthProvider) hasn't resolved yet — render
  // nothing rather than flashing AuthScreen for a logged-in user whose
  // cookie is still being exchanged for a fresh access token.
  if (authLoading) return null;
  if (!user) return <AuthScreen />;

  return (
    <div className={clsx(T.app, "relative transition-[background-color,color] duration-[400ms] ease")} style={activeTheme?.app}>
      <AppOverlays
        curtain={curtain}
        activeTheme={activeTheme}
        accentColor={accentColor}
        showDevNotice={showDevNotice}
        dismissDevNotice={dismissDevNotice}
        showBackConfirm={showBackConfirm}
        confirmGoBack={confirmGoBack}
        setShowBackConfirm={setShowBackConfirm}
        showLocalResetConfirm={showLocalResetConfirm}
        setShowLocalResetConfirm={setShowLocalResetConfirm}
        localGameResetRef={localGameResetRef}
        showExitConfirm={showExitConfirm}
        groupAttached={groupAttached}
        goHome={goHome}
        setShowExitConfirm={setShowExitConfirm}
        showReturnToGroupConfirm={showReturnToGroupConfirm}
        setShowReturnToGroupConfirm={setShowReturnToGroupConfirm}
        returnToGroupRef={returnToGroupRef}
      />
      <AppMainContent
        gameId={gameId}
        mode={mode}
        groupFlow={groupFlow}
        groupAttached={groupAttached}
        game={game}
        accentColor={accentColor}
        mutedColor={mutedColor}
        playerName={playerName}
        savePlayerName={savePlayerName}
        goBack={goBack}
        setShowExitConfirm={setShowExitConfirm}
        showProfileMenu={showProfileMenu}
        setShowProfileMenu={setShowProfileMenu}
        profileMenuRef={profileMenuRef}
        startGroupFlow={startGroupFlow}
        showRules={showRules}
        setShowRules={setShowRules}
        stepKey={stepKey}
        stepDirection={stepDirection}
        curtain={curtain}
        contextValues={contextValues}
        inGameView={inGameView}
      />
    </div>
  );
}
