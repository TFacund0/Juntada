import { createRequiredContext } from "./createRequiredContext";

// Mirrors the 3 top-level navigation callbacks pages call to leave/change
// the current screen: pickGame/goHome from useAppShell, goBack from
// useBackNavigation.
export interface AppShellContextValue {
  pickGame: (gameId: string) => void;
  goHome: () => void;
  goBack: () => void;
  // Sets the App-level "fuiste expulsado del grupo" notice — see
  // useAppDialogs' kickedNotice. Callers (useMultiplayerEntryProps) call
  // this and then goHome, in that order, so the message is already in state
  // by the time the group screen unmounts.
  notifyKicked: (message: string) => void;
}

export const [AppShellContext, useAppShellContext] = createRequiredContext<AppShellContextValue>("AppShellContext");
