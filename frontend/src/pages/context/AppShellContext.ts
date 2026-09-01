import { createRequiredContext } from "./createRequiredContext";

// Mirrors the 3 top-level navigation callbacks pages call to leave/change
// the current screen: pickGame/goHome from useAppShell, goBack from
// useBackNavigation.
export interface AppShellContextValue {
  pickGame: (gameId: string) => void;
  goHome: () => void;
  goBack: () => void;
}

export const [AppShellContext, useAppShellContext] = createRequiredContext<AppShellContextValue>("AppShellContext");
