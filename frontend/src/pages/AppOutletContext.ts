import type { GameDef } from "../games/gameTypes";
import type { JoinLink } from "../features/multiplayer/utils/joinLink";

// Everything the page components under frontend/src/pages/ need from App's
// six slice-(b) leaf hooks (useAppSession, useGameBridgeRefs, useAppDialogs,
// useHeaderUI, useBackNavigation, useStepTransition), grouped for
// useOutletContext<AppOutletContext>() — App itself stays the layout route
// that owns/creates these hooks and passes them down via <Outlet context=.
//
// This is a plain TypeScript type consumed through react-router-dom's
// useOutletContext() hook, NOT a React Context (no createContext here) — see
// design.md for why: App must stay the single non-remounting parent route,
// and useOutletContext is the mechanism react-router-dom provides for a
// parent layout route to hand data down to whichever child route element is
// currently rendered.
export interface AppOutletContext {
  // ── useAppSession ──
  gameId: string | null;
  setGameId: (id: string | null) => void;
  mode: "local" | "multi" | null;
  setMode: (mode: "local" | "multi" | null) => void;
  game: GameDef | null | undefined;
  groupFlow: boolean;
  groupIntent: "create" | "join" | undefined;
  pendingGroupJoinCode: string | null;
  switchToGroupJoin: (code: string) => void;
  setRoomCode: (code: string | null) => void;
  setGroupCode: (code: string | null) => void;
  groupAttached: boolean;
  setGroupAttached: (attached: boolean) => void;
  setRoomPhase: (phase: string | null) => void;
  handleRoomGameType: (roomGameType: string | null) => void;
  GAME_LIST: GameDef[];

  // ── useGameBridgeRefs ──
  exposeReturnToGroup: (fn: () => void) => void;
  exposeLocalGameBack: (fn: () => boolean) => void;
  exposeLocalGameReset: (fn: () => void) => void;

  // ── App-level (playerName, validJoinLink, curtain from useStepTransition) ──
  playerName: string;
  savePlayerName: (name: string) => void;
  validJoinLink: JoinLink | null;
  curtain: "none" | "out" | "in";
  withCurtain: (action: () => void, themed?: boolean) => void;
  withAsyncCurtain: (action: (settle: () => void) => void | Promise<void>, themed?: boolean) => void;
  settleAsyncCurtain: () => void;

  // ── App-level shell callbacks (useAppShell) ──
  pickGame: (gameId: string) => void;
  goHome: () => void;

  // ── useBackNavigation ──
  goBack: () => void;
}
